interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * OECD MCP — Organisation for Economic Co-operation and Development data
 * (free, no auth) via the SDMX 2.1 REST API at sdmx.oecd.org.
 *
 * OECD covers areas that FRED / World Bank / IMF / Eurostat don't always reach:
 * inter-country tax, education at a glance, regional indicators, well-being,
 * household debt, ICT use, productivity, environmental performance.
 *
 * Tools:
 * - list_curated_flows:   pre-vetted dataflow refs by topic (GDP, prices, jobs, etc.)
 * - search_dataflows:     query the SDMX dataflow registry by keyword
 * - fetch_dataset:        return tidy rows for one dataset (CSV with labels under the hood)
 *
 * Find flow refs interactively at https://data-explorer.oecd.org
 */


const SDMX_BASE = 'https://sdmx.oecd.org/public/rest';

interface CuratedFlow {
  flow_ref: string;
  topic: string;
  title: string;
  notes?: string;
}

const CURATED_FLOWS: CuratedFlow[] = [
  {
    flow_ref: 'OECD.SDD.NAD,DSD_NAMAIN1@DF_QNA_EXPENDITURE_GROWTH,1.0',
    topic: 'gdp',
    title: 'Quarterly GDP growth, expenditure approach',
  },
  {
    flow_ref: 'OECD.SDD.TPS,DSD_LFS@DF_IALFS_INDIC,1.0',
    topic: 'labour',
    title: 'Labour force statistics — unemployment, employment',
  },
  {
    flow_ref: 'OECD.SDD.TPS,DSD_PRICES@DF_PRICES_ALL,1.0',
    topic: 'prices',
    title: 'Consumer prices — headline and core CPI by country',
  },
  {
    flow_ref: 'OECD.STD.STES,DSD_STES@DF_FINMARK,1.0',
    topic: 'finance',
    title: 'Financial markets — short-term and long-term interest rates',
  },
  {
    flow_ref: 'OECD.SDD.NAD,DSD_HH@DF_HH_DASH,1.0',
    topic: 'households',
    title: 'Household dashboard — disposable income, savings, debt',
  },
  {
    flow_ref: 'OECD.WISE,DSD_HSP@DF_HSP,1.0',
    topic: 'health',
    title: 'Health spending and resources',
  },
  {
    flow_ref: 'OECD.SDD.TPS,DSD_POPULATION@DF_POP_HIST,1.0',
    topic: 'demographics',
    title: 'Historical population by age and sex',
  },
  {
    flow_ref: 'OECD.ECO,DSD_EO@DF_EO,1.0',
    topic: 'projections',
    title: 'Economic Outlook — forward-looking projections',
  },
  {
    flow_ref: 'OECD.CTP,DSD_REV@DF_REV,1.0',
    topic: 'tax',
    title: 'Revenue statistics — tax revenue by country and type',
  },
  {
    flow_ref: 'OECD.EDU.IMEP,DSD_EAG_FIN_RES@DF_EDU_FIN_INDIC,1.0',
    topic: 'education',
    title: 'Education at a glance — financial indicators',
  },
  {
    flow_ref: 'OECD.ENV,DSD_AIR_GHG@DF_AIR_GHG,1.0',
    topic: 'environment',
    title: 'Greenhouse-gas emissions by source',
  },
  {
    flow_ref: 'OECD.STI.PIE,DSD_ICT@DF_BUS_ICTU,1.0',
    topic: 'technology',
    title: 'ICT use by businesses',
  },
];

const tools: McpToolExport['tools'] = [
  {
    name: 'list_curated_flows',
    description:
      'List OECD dataflow refs we have pre-vetted, grouped by topic (gdp, labour, prices, finance, households, health, demographics, projections, tax, education, environment, technology). Pass the flow_ref to fetch_dataset. For everything else use search_dataflows or browse https://data-explorer.oecd.org.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Optional topic filter' },
      },
      required: [],
    },
  },
  {
    name: 'search_dataflows',
    description:
      'Search OECD\'s SDMX dataflow registry by keyword. Returns matching dataflow refs ready to pass to fetch_dataset. If results are noisy, refine with a more specific keyword or restrict by agency.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword (matches dataflow names + descriptions)' },
        agency: {
          type: 'string',
          description: 'Optional agency filter, e.g., OECD.SDD.NAD, OECD.ECO, OECD.ENV',
        },
        limit: { type: 'number', description: 'Max results (default 25, max 100)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'fetch_dataset',
    description:
      'Fetch tidy rows from any OECD dataflow. flow_ref examples: "OECD.SDD.NAD,DSD_NAMAIN1@DF_QNA_EXPENDITURE_GROWTH,1.0". The key string is a dot-separated dimension filter (e.g., "USA.....Q" — leave empty to fetch everything). Use start/end periods like "2020-Q1" or "2020". Returns labeled rows; OECD enforces a result-size limit and may truncate broad queries — narrow with key dimensions or shorter time ranges.',
    inputSchema: {
      type: 'object',
      properties: {
        flow_ref: { type: 'string', description: 'SDMX dataflow reference' },
        key: { type: 'string', description: 'Dot-separated dimension key (or empty for all)' },
        start_period: { type: 'string', description: 'e.g., "2020", "2020-Q1", "2020-01"' },
        end_period: { type: 'string', description: 'Inclusive end period' },
        limit: { type: 'number', description: 'Cap rows returned (default 5000)' },
      },
      required: ['flow_ref'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'list_curated_flows':
      return listCurated(args.topic as string | undefined);
    case 'search_dataflows':
      return searchDataflows(
        args.query as string,
        args.agency as string | undefined,
        (args.limit as number) ?? 25,
      );
    case 'fetch_dataset':
      return fetchDataset(
        args.flow_ref as string,
        (args.key as string | undefined) ?? '',
        args.start_period as string | undefined,
        args.end_period as string | undefined,
        (args.limit as number) ?? 5000,
      );
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function listCurated(topic?: string) {
  const filtered = topic ? CURATED_FLOWS.filter((f) => f.topic === topic) : CURATED_FLOWS;
  return {
    count: filtered.length,
    topics: Array.from(new Set(CURATED_FLOWS.map((f) => f.topic))).sort(),
    flows: filtered,
    note: 'For full catalog: https://data-explorer.oecd.org or search_dataflows.',
  };
}

async function searchDataflows(query: string, agency: string | undefined, limit: number) {
  // Agency-scoped listing if provided, otherwise all
  const agencyPath = agency ?? 'all';
  const url = `${SDMX_BASE}/dataflow/${agencyPath}/all/latest?detail=allstubs`;

  const res = await fetch(url, { headers: { Accept: 'application/vnd.sdmx.structure+json;version=1.0' } });
  if (!res.ok) {
    throw new Error(`OECD dataflow registry error: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as {
    data?: {
      dataflows?: {
        id?: string;
        agencyID?: string;
        version?: string;
        name?: string;
        names?: Record<string, string>;
      }[];
    };
  };

  const q = query.toLowerCase();
  const flows = data.data?.dataflows ?? [];
  const matched = flows.filter((f) => {
    const name = (f.name ?? f.names?.en ?? '').toLowerCase();
    return name.includes(q) || (f.id ?? '').toLowerCase().includes(q);
  });
  const capped = matched.slice(0, Math.min(100, Math.max(1, limit)));

  return {
    total_matched: matched.length,
    returned: capped.length,
    dataflows: capped.map((f) => ({
      flow_ref: `${f.agencyID ?? 'OECD'},${f.id ?? ''},${f.version ?? '1.0'}`,
      agency: f.agencyID ?? null,
      id: f.id ?? null,
      version: f.version ?? null,
      name: f.name ?? f.names?.en ?? null,
    })),
  };
}

async function fetchDataset(
  flowRef: string,
  key: string,
  start: string | undefined,
  end: string | undefined,
  limit: number,
) {
  const url = new URL(`${SDMX_BASE}/data/${encodeURIComponent(flowRef)}/${key}`);
  url.searchParams.set('format', 'csvfilewithlabels');
  if (start) url.searchParams.set('startPeriod', start);
  if (end) url.searchParams.set('endPeriod', end);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OECD data error: ${res.status} ${body.slice(0, 200)}`);
  }
  const csv = await res.text();
  const rows = parseCsv(csv);
  if (rows.length === 0) return { flow_ref: flowRef, columns: [], count: 0, rows: [] };

  const header = rows[0];
  const out: Record<string, string>[] = [];
  for (let i = 1; i < rows.length && out.length < limit; i++) {
    const r = rows[i];
    if (r.length === 1 && r[0] === '') continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) obj[header[c]] = r[c] ?? '';
    out.push(obj);
  }

  return {
    flow_ref: flowRef,
    source_url: `https://data-explorer.oecd.org/?fs[0]=Topic%2C0&pg=0&fc=Topic&snb=&qf=DataflowId%3D${flowRef}`,
    columns: header,
    truncated: rows.length - 1 > limit,
    count: out.length,
    rows: out,
  };
}

// ── CSV parsing (OECD emits standard quoted CSV) ──────────────────────
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') {
        row.push(cell);
        cell = '';
      } else if (ch === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else if (ch === '\r') {
        // skip
      } else {
        cell += ch;
      }
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;

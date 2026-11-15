/** Parse Stata .do label file from a Survey Solutions export into lookup maps. */

export interface Labels {
  /** variable -> variable label */
  variables: Record<string, string>;
  /** variable -> value-set name */
  values: Record<string, string>;
  /** value-set name -> { code -> label } */
  valueSets: Record<string, Record<string, string>>;
}

export function parseDoFile(text: string): Labels {
  const out: Labels = { variables: {}, values: {}, valueSets: {} };
  for (const line of text.split(/\r?\n/)) {
    let m = line.match(/^label variable (\S+)\s+`"(.*)"'\s*$/);
    if (m) {
      out.variables[m[1]] = m[2];
      continue;
    }
    m = line.match(/^label define (\S+)\s+(.*)$/);
    if (m) {
      const set: Record<string, string> = out.valueSets[m[1]] || {};
      const re = /(-?\d+)\s+`"(.*?)"'/g;
      let mm: RegExpExecArray | null;
      while ((mm = re.exec(m[2]))) set[mm[1]] = mm[2];
      out.valueSets[m[1]] = set;
      continue;
    }
    m = line.match(/^label values (\S+)\s+(\S+)/);
    if (m) out.values[m[1]] = m[2];
  }
  return out;
}

export function valueLabel(labels: Labels, variable: string, code: string | number | null | undefined): string | null {
  if (code === null || code === undefined || code === "") return null;
  const set = labels.valueSets[labels.values[variable] || variable];
  return set?.[String(code)] ?? null;
}

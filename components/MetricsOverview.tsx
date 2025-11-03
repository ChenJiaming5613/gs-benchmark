"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type MetricsOverviewRow = {
  experiment: string;
  iteration: string;
  rawIteration: string;
  metrics: Record<string, number | null>;
  experimentName?: string;
};

export type MetricsOverviewProps = {
  directories: string[];
  selectedRowKeys: string[];
  onSelectedRowKeysChange?: (keys: string[], rows: MetricsOverviewRow[]) => void;
};

export function MetricsOverview({
  directories,
  selectedRowKeys,
  onSelectedRowKeysChange,
}: MetricsOverviewProps) {
  const [rows, setRows] = useState<MetricsOverviewRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [experimentNames, setExperimentNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      if (!directories.length) {
        setRows([]);
        setErrors([]);
        setExperimentNames({});
        return;
      }

      setLoading(true);
      setErrors([]);

      try {
        const response = await fetch("/api/results", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ directories }),
        });

        const payload = await response.json();

        if (!response.ok) {
          const message = payload?.error || "Failed to load metrics";
          setErrors([message]);
          setRows([]);
          return;
        }

        const rawRows: MetricsOverviewRow[] = Array.isArray(payload?.rows)
          ? payload.rows
          : [];
        const sortedRows = [...rawRows].sort((a, b) => {
          const iterationCompare = a.iteration.localeCompare(b.iteration, "en", {
            numeric: true,
          });
          if (iterationCompare !== 0) {
            return iterationCompare;
          }

          return a.experiment.localeCompare(b.experiment, "en", { numeric: true });
        });

        const firstDirectory = directories[0];
        const augmentedRows = firstDirectory
          ? [
              {
                experiment: firstDirectory,
                iteration: "-",
                rawIteration: "__gt__",
                metrics: {},
                experimentName: "gt",
              },
              ...sortedRows,
            ]
          : sortedRows;

        setRows(augmentedRows);
        setErrors(Array.isArray(payload?.errors) ? payload.errors : []);
        setExperimentNames((previous) => {
          if (!sortedRows.length) {
            return {};
          }

          const experiments = Array.from(new Set(sortedRows.map((row) => row.experiment)));
          let changed = false;
          const next: Record<string, string> = {};

          experiments.forEach((experiment, index) => {
            const existing = previous[experiment];
            if (existing) {
              next[experiment] = existing;
            } else {
              next[experiment] = `exp${index + 1}`;
              changed = true;
            }
          });

          Object.keys(previous).forEach((experiment) => {
            if (!next[experiment]) {
              changed = true;
            }
          });

          return changed ? next : previous;
        });
      } catch (error) {
        console.error(error);
        setErrors(["Unable to fetch metrics. Please try again later."]);
        setRows([]);
        setExperimentNames({});
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [directories]);

  const rowsWithNames = useMemo<MetricsOverviewRow[]>(
    () =>
      rows.map((row) => ({
        ...row,
        experimentName: row.experimentName ?? experimentNames[row.experiment] ?? "",
      })),
    [rows, experimentNames]
  );

  const metricColumns = useMemo(() => {
    const names = new Set<string>();
    rowsWithNames.forEach((row) => {
      Object.keys(row.metrics ?? {}).forEach((name) => names.add(name));
    });
    return Array.from(names).sort();
  }, [rowsWithNames]);

  const rowMap = useMemo(() => {
    const map = new Map<string, MetricsOverviewRow>();
    rowsWithNames.forEach((row) => {
      map.set(`${row.experiment}__${row.rawIteration}`, row);
    });
    return map;
  }, [rowsWithNames]);

  const lastSyncedSignature = useRef<string | null>(null);

  useEffect(() => {
    if (!onSelectedRowKeysChange) {
      return;
    }

    const validKeys: string[] = [];
    const selectedRows: MetricsOverviewRow[] = [];

    selectedRowKeys.forEach((key) => {
      const row = rowMap.get(key);
      if (row) {
        validKeys.push(key);
        selectedRows.push(row);
      }
    });

    const signature = JSON.stringify(
      selectedRows.map((row) => [row.experiment, row.rawIteration, row.experimentName ?? ""])
    );

    if (
      signature === lastSyncedSignature.current &&
      validKeys.length === selectedRowKeys.length
    ) {
      return;
    }

    lastSyncedSignature.current = signature;
    onSelectedRowKeysChange(validKeys, selectedRows);
  }, [selectedRowKeys, rowMap, onSelectedRowKeysChange]);

  const handleExperimentNameChange = (experiment: string, value: string) => {
    setExperimentNames((previous) => ({
      ...previous,
      [experiment]: value,
    }));
  };

  const handleToggleRow = (key: string) => {
    if (!onSelectedRowKeysChange) {
      return;
    }

    const nextKeys = new Set(selectedRowKeys);
    if (nextKeys.has(key)) {
      nextKeys.delete(key);
    } else {
      nextKeys.add(key);
    }

    const arrayKeys = Array.from(nextKeys);
    const selectedRows = arrayKeys.map((item) => rowMap.get(item)!).filter(Boolean);
    onSelectedRowKeysChange(arrayKeys, selectedRows);
  };

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-6 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div>
        <p className="font-medium">Metrics Overview</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          Every loaded directory and iteration is listed below. Select multiple rows to compare.
        </p>
      </div>

      {errors.length > 0 && (
        <ul className="space-y-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          {errors.map((message, index) => (
            <li key={index}>⚠️ {message}</li>
          ))}
        </ul>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 text-xs dark:divide-zinc-700">
          <thead className="bg-zinc-100 dark:bg-zinc-950">
            <tr>
              <th className="w-12 px-3 py-2 text-left text-zinc-900 dark:text-zinc-100">
                <span className="sr-only">选择</span>
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-zinc-900 dark:text-zinc-100">
                exp_name
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-zinc-900 dark:text-zinc-100">
                model_path
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-zinc-900 dark:text-zinc-100">
                iteration
              </th>
              {metricColumns.map((metric) => (
                <th
                  key={metric}
                  className="whitespace-nowrap px-3 py-2 text-left font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-100"
                >
                  {metric}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {loading ? (
              <tr>
                <td
                  className="px-3 py-4 text-center text-zinc-500 dark:text-zinc-400"
                  colSpan={4 + metricColumns.length}
                >
                  Loading metrics...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  className="px-3 py-4 text-center text-zinc-500 dark:text-zinc-400"
                  colSpan={4 + metricColumns.length}
                >
                  No metrics found. Please ensure a results.json file exists in each directory.
                </td>
              </tr>
            ) : (
              rowsWithNames.map((row, index) => {
                const key = `${row.experiment}__${row.rawIteration}`;
                const checked = selectedRowKeys.includes(key);
                const currentExperimentName = row.experimentName ?? "";

                return (
                  <tr
                    key={`${key}-${index}`}
                    className={checked ? "bg-zinc-100/60 dark:bg-zinc-800/40" : undefined}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                        checked={checked}
                        onChange={() => handleToggleRow(key)}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-700 dark:text-zinc-200">
                      <input
                        className="w-24 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                        value={currentExperimentName}
                        onChange={(event) => handleExperimentNameChange(row.experiment, event.target.value)}
                        placeholder="exp1"
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-700 dark:text-zinc-200">
                      {row.experiment}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-700 dark:text-zinc-200">
                      {row.iteration}
                    </td>
                    {metricColumns.map((metric) => {
                      const value = row.metrics?.[metric] ?? null;
                      return (
                        <td
                          key={`${key}-${metric}`}
                          className="whitespace-nowrap px-3 py-2 text-zinc-700 dark:text-zinc-200"
                        >
                          {typeof value === "number" && Number.isFinite(value)
                            ? value.toFixed(4)
                            : value ?? "-"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

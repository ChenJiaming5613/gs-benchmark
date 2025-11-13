"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ExperimentNames = Record<string, string>;
type ExperimentNamesUpdater = ExperimentNames | ((previous: ExperimentNames) => ExperimentNames);
type UpdateExperimentNamesOptions = { notify?: boolean };

const areExperimentNameRecordsEqual = (a: ExperimentNames, b: ExperimentNames) => {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (a[key] !== b[key]) {
      return false;
    }
  }

  return true;
};

const METRIC_LABELS: Record<string, string> = {
  point_cloud_size_mb: "model size (MB)",
};

const formatMetricLabel = (metric: string) => METRIC_LABELS[metric] ?? metric;

const HIGHLIGHT_TOP_METRICS = new Set(["ssim", "psnr"]);
const HIGHLIGHT_BOTTOM_METRICS = new Set(["lpips"]);
const METRIC_MEDAL_CLASSES = [
  "text-red-500 dark:text-red-300",
  "text-amber-500 dark:text-amber-300",
  "text-lime-400 dark:text-lime-300",
];
const VALUE_EPSILON = 1e-9;

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
  initialExperimentNames?: Record<string, string>;
  onExperimentNamesChange?: (names: Record<string, string>) => void;
};

export function MetricsOverview({
  directories,
  selectedRowKeys,
  onSelectedRowKeysChange,
  initialExperimentNames,
  onExperimentNamesChange,
}: MetricsOverviewProps) {
  const [rows, setRows] = useState<MetricsOverviewRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [experimentNames, setExperimentNames] = useState<Record<string, string>>({});
  const pendingExperimentNamesRef = useRef<ExperimentNames | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const updateExperimentNames = useCallback(
    (updater: ExperimentNamesUpdater, options?: UpdateExperimentNamesOptions) => {
      setExperimentNames((previous) => {
        const next = typeof updater === "function" ? updater(previous) : updater;

        if (areExperimentNameRecordsEqual(previous, next)) {
          if (options?.notify === false) {
            pendingExperimentNamesRef.current = null;
          }
          return previous;
        }

        if (options?.notify === false) {
          pendingExperimentNamesRef.current = null;
        } else {
          pendingExperimentNamesRef.current = next;
        }

        return next;
      });
    },
    []
  );

  useEffect(() => {
    if (!initialExperimentNames) {
      return;
    }

    updateExperimentNames((previous) => {
      if (areExperimentNameRecordsEqual(previous, initialExperimentNames)) {
        return previous;
      }

      return initialExperimentNames;
    }, { notify: false });
  }, [initialExperimentNames, updateExperimentNames]);

  useEffect(() => {
    if (!onExperimentNamesChange) {
      return;
    }

    if (!pendingExperimentNamesRef.current) {
      return;
    }

    onExperimentNamesChange(pendingExperimentNamesRef.current);
    pendingExperimentNamesRef.current = null;
  }, [experimentNames, onExperimentNamesChange]);

  useEffect(() => {
    const load = async () => {
      if (!directories.length) {
        setRows([]);
        setErrors([]);
        updateExperimentNames((previous) => {
          if (Object.keys(previous).length === 0) {
            return previous;
          }
          return {};
        });
        return;
      }

      setLoading(true);
      setErrors([]);

      try {
        const response = await fetch("/api/metrics/aggregate", {
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

        const directoryOrder = new Map<string, number>();
        directories.forEach((directory, index) => {
          directoryOrder.set(directory, index);
        });

        const sortedRows = [...rawRows].sort((a, b) => {
          const directoryIndexA = directoryOrder.get(a.experiment) ?? Number.MAX_SAFE_INTEGER;
          const directoryIndexB = directoryOrder.get(b.experiment) ?? Number.MAX_SAFE_INTEGER;
          if (directoryIndexA !== directoryIndexB) {
            return directoryIndexA - directoryIndexB;
          }

          const iterationCompare = a.iteration.localeCompare(b.iteration, "en", {
            numeric: true,
          });
          if (iterationCompare !== 0) {
            return iterationCompare;
          }

          return a.experiment.localeCompare(b.experiment, "en", { numeric: true });
        });

        const firstDirectory = directories[0];
        const augmentedRows =
          firstDirectory && sortedRows.some((row) => row.experiment === firstDirectory)
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
        updateExperimentNames((previous) => {
          if (!sortedRows.length) {
            return {};
          }

          const experiments = Array.from(new Set(sortedRows.map((row) => row.experiment))).sort((a, b) => {
            const orderA = directoryOrder.get(a) ?? Number.MAX_SAFE_INTEGER;
            const orderB = directoryOrder.get(b) ?? Number.MAX_SAFE_INTEGER;
            if (orderA === orderB) {
              return a.localeCompare(b, "en", { numeric: true });
            }
            return orderA - orderB;
          });
          if (!experiments.length) {
            return previous;
          }

          let changed = false;
          const next: Record<string, string> = {};
          const usedLabels = new Set<string>();
          let maxNumber = 0;

          experiments.forEach((experiment) => {
            const existing = previous[experiment];
            if (existing) {
              next[experiment] = existing;
              usedLabels.add(existing);
              const match = /^exp(\d+)$/.exec(existing);
              if (match) {
                const numeric = Number(match[1]);
                if (numeric > maxNumber) {
                  maxNumber = numeric;
                }
              }
            }
          });

          experiments.forEach((experiment) => {
            if (next[experiment]) {
              return;
            }

            let candidate = maxNumber + 1;
            let label = `exp${candidate}`;
            while (usedLabels.has(label)) {
              candidate += 1;
              label = `exp${candidate}`;
            }
            maxNumber = candidate;
            next[experiment] = label;
            usedLabels.add(label);
            changed = true;
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

  const getRowKey = useCallback((row: MetricsOverviewRow) => `${row.experiment}__${row.rawIteration}`, []);

  const rowsWithNames = useMemo<MetricsOverviewRow[]>(
    () =>
      rows.map((row) => ({
        ...row,
        experimentName: row.experimentName ?? experimentNames[row.experiment] ?? "",
      })),
    [rows, experimentNames]
  );

  const allRowKeys = useMemo(() => rowsWithNames.map((row) => getRowKey(row)), [rowsWithNames, getRowKey]);

  const selectedCount = useMemo(
    () => selectedRowKeys.filter((key) => allRowKeys.includes(key)).length,
    [selectedRowKeys, allRowKeys]
  );

  const isAllSelected = allRowKeys.length > 0 && selectedCount === allRowKeys.length;
  const isSomeSelected = selectedCount > 0 && selectedCount < allRowKeys.length;

  const metricColumns = useMemo(() => {
    const names = new Set<string>();
    rowsWithNames.forEach((row) => {
      Object.keys(row.metrics ?? {}).forEach((name) => names.add(name));
    });
    return Array.from(names).sort();
  }, [rowsWithNames]);

  const metricHighlightMap = useMemo(() => {
    const highlights = new Map<string, Record<string, string>>();

    metricColumns.forEach((metric) => {
      const normalizedMetric = metric.toLowerCase();
      const highlightTop = HIGHLIGHT_TOP_METRICS.has(normalizedMetric);
      const highlightBottom = HIGHLIGHT_BOTTOM_METRICS.has(normalizedMetric);

      if (!highlightTop && !highlightBottom) {
        return;
      }

      const entries: { key: string; value: number }[] = [];

      rowsWithNames.forEach((row) => {
        const raw = row.metrics?.[metric] ?? null;
        if (typeof raw === "number" && Number.isFinite(raw)) {
          entries.push({ key: getRowKey(row), value: raw });
        }
      });

      if (!entries.length) {
        return;
      }

      entries.sort((a, b) => {
        if (highlightTop) {
          return b.value - a.value;
        }
        return a.value - b.value;
      });

      let uniqueRank = 0;
      let lastValue: number | null = null;
      let currentMedalIndex = -1;

      for (const entry of entries) {
        if (lastValue === null || Math.abs(entry.value - lastValue) > VALUE_EPSILON) {
          uniqueRank += 1;

          if (uniqueRank > METRIC_MEDAL_CLASSES.length) {
            break;
          }

          currentMedalIndex = uniqueRank - 1;
          lastValue = entry.value;
        }

        if (currentMedalIndex < 0 || currentMedalIndex >= METRIC_MEDAL_CLASSES.length) {
          continue;
        }

        const existing = highlights.get(entry.key) ?? {};
        existing[metric] = METRIC_MEDAL_CLASSES[currentMedalIndex];
        highlights.set(entry.key, existing);
      }
    });

    return highlights;
  }, [getRowKey, metricColumns, rowsWithNames]);

  const lastSyncedSignature = useRef<string | null>(null);

  useEffect(() => {
    if (!onSelectedRowKeysChange) {
      return;
    }

    const validKeys: string[] = [];
    const selectedRows: MetricsOverviewRow[] = [];

    selectedRowKeys.forEach((key) => {
      const row = rowsWithNames.find((candidate) => getRowKey(candidate) === key);
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
  }, [selectedRowKeys, rowsWithNames, getRowKey, onSelectedRowKeysChange]);

  const handleExperimentNameChange = (experiment: string, value: string) => {
    updateExperimentNames((previous) => {
      if (previous[experiment] === value) {
        return previous;
      }

      return {
        ...previous,
        [experiment]: value,
      };
    });
  };

  const reorderRows = useCallback(
    (sourceIndex: number, targetIndex: number) => {
      if (sourceIndex === targetIndex) {
        return;
      }

      let updatedRows: MetricsOverviewRow[] | null = null;

      setRows((previous) => {
        if (
          sourceIndex < 0 ||
          sourceIndex >= previous.length ||
          targetIndex < 0 ||
          targetIndex >= previous.length
        ) {
          return previous;
        }

        const next = [...previous];
        const [moved] = next.splice(sourceIndex, 1);
        next.splice(targetIndex, 0, moved);

        updatedRows = next;
        return next;
      });

      if (!onSelectedRowKeysChange) {
        return;
      }

      const sourceRows = updatedRows ?? rows;
      const rowByKey = new Map<string, MetricsOverviewRow>();
      sourceRows.forEach((row) => {
        rowByKey.set(getRowKey(row), row);
      });

      const nextKeys: string[] = [];
      const enrichedRows: MetricsOverviewRow[] = [];

      selectedRowKeys.forEach((selectedKey) => {
        const row = rowByKey.get(selectedKey);
        if (!row) {
          return;
        }
        nextKeys.push(selectedKey);
        enrichedRows.push({
          ...row,
          experimentName: row.experimentName ?? experimentNames[row.experiment] ?? "",
        });
      });

      onSelectedRowKeysChange(nextKeys, enrichedRows);
      setDropTargetIndex(null);
    },
    [experimentNames, getRowKey, onSelectedRowKeysChange, rows, selectedRowKeys]
  );

  const handleToggleRow = (key: string) => {
    if (!onSelectedRowKeysChange) {
      return;
    }

    const exists = rowsWithNames.some((row) => getRowKey(row) === key);
    if (!exists) {
      return;
    }

    let orderedKeys: string[];
    if (selectedRowKeys.includes(key)) {
      orderedKeys = selectedRowKeys.filter((existingKey) => existingKey !== key);
    } else {
      orderedKeys = [...selectedRowKeys, key];
    }

    const orderedRows: MetricsOverviewRow[] = orderedKeys
      .map((orderedKey) => rowsWithNames.find((row) => getRowKey(row) === orderedKey))
      .filter((value): value is MetricsOverviewRow => Boolean(value));

    onSelectedRowKeysChange(orderedKeys, orderedRows);
  };

  const handleToggleAll = useCallback(() => {
    if (!onSelectedRowKeysChange) {
      return;
    }

    if (isAllSelected) {
      onSelectedRowKeysChange([], []);
      return;
    }

    if (!rowsWithNames.length) {
      onSelectedRowKeysChange([], []);
      return;
    }

    const keys = rowsWithNames.map((row) => getRowKey(row));
    onSelectedRowKeysChange(keys, rowsWithNames);
  }, [getRowKey, isAllSelected, onSelectedRowKeysChange, rowsWithNames]);

  useEffect(() => {
    if (!selectAllRef.current) {
      return;
    }
    selectAllRef.current.indeterminate = isSomeSelected;
  }, [isSomeSelected]);

  const handleExport = useCallback(() => {
    if (!rowsWithNames.length) {
      return;
    }

    const metricHeaders = metricColumns.filter((metric) => metric !== "point_cloud_size_mb");
    const headers = ["exp_name", "model_path", "iteration", ...metricHeaders, "model_size"];

    const formatValue = (value: number | null | undefined) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return value.toFixed(4);
      }
      return value ?? "";
    };

    const escapeCsv = (value: string | number) => {
      const stringValue = String(value ?? "");
      if (stringValue === "") {
        return "";
      }
      if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const rows = rowsWithNames.map((row) => {
      const fields: (string | number)[] = [
        row.experimentName ?? row.experiment,
        row.experiment,
        row.iteration === "-" ? "" : row.iteration,
        ...metricHeaders.map((metric) => formatValue(row.metrics?.[metric] ?? null)),
        formatValue(row.metrics?.point_cloud_size_mb ?? null),
      ];

      return fields.map(escapeCsv).join(",");
    });

    const csvContent = [headers.map(escapeCsv).join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const link = document.createElement("a");
    link.href = url;
    link.download = `metrics-overview-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [metricColumns, rowsWithNames]);

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
              <th className="w-16 px-3 py-2 text-left align-middle text-zinc-900 dark:text-zinc-100">
                <div className="flex h-full items-center">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                    checked={isAllSelected}
                    onChange={handleToggleAll}
                    disabled={!rowsWithNames.length}
                  />
                </div>
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
                  className="whitespace-nowrap px-3 py-2 text-left font-semibold tracking-wide text-zinc-900 dark:text-zinc-100"
                >
                  {formatMetricLabel(metric)}
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
                const selectionOrder = selectedRowKeys.indexOf(key);
                const checked = selectionOrder !== -1;
                const currentExperimentName = row.experimentName ?? "";
                const isDragging = draggingIndex === index;
                const isDropTarget =
                  dropTargetIndex === index && draggingIndex !== null && draggingIndex !== index;

                const transforms: string[] = [];
                const style: React.CSSProperties = {};

                if (isDragging) {
                  transforms.push("scale(1.01)");
                  style.position = "relative";
                  style.zIndex = 10;
                }

                if (transforms.length > 0) {
                  style.transform = transforms.join(" ");
                }

                return (
                  <tr
                    key={`${key}-${index}`}
                    className={`cursor-move transition-colors ${
                      checked ? "bg-zinc-100/60 dark:bg-zinc-800/40" : ""
                    } ${
                      isDragging
                        ? "bg-zinc-200/90 dark:bg-zinc-700/70 ring-2 ring-zinc-400/60 dark:ring-zinc-500/60 shadow-lg"
                        : ""
                    } ${
                      isDropTarget
                        ? "bg-blue-100/70 dark:bg-blue-900/40 ring-1 ring-blue-300/50 dark:ring-blue-700/50"
                        : ""
                    }`}
                    style={Object.keys(style).length > 0 ? style : undefined}
                    draggable
                    onDragStart={(event) => {
                      setDraggingIndex(index);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", key);
                    }}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      if (draggingIndex === null || draggingIndex === index) {
                        return;
                      }
                      if (dropTargetIndex !== index) {
                        setDropTargetIndex(index);
                      }
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (draggingIndex === null || draggingIndex === index) {
                        return;
                      }
                      if (dropTargetIndex !== index) {
                        setDropTargetIndex(index);
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (draggingIndex === null) {
                        return;
                      }
                      reorderRows(draggingIndex, index);
                      setDraggingIndex(null);
                      setDropTargetIndex(null);
                    }}
                    onDragEnd={() => {
                      setDraggingIndex(null);
                      setDropTargetIndex(null);
                    }}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                          checked={checked}
                          onChange={() => handleToggleRow(key)}
                        />
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {checked ? selectionOrder : " "}
                        </span>
                      </div>
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
                      const highlightClass = metricHighlightMap.get(key)?.[metric] ?? "";
                      const textClass = highlightClass || "text-zinc-700 dark:text-zinc-200";
                      return (
                        <td
                          key={`${key}-${metric}`}
                          className={`whitespace-nowrap px-3 py-2 ${textClass}`}
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

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleExport}
          disabled={!rowsWithNames.length}
          className="rounded-md bg-zinc-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Export CSV
        </button>
      </div>
    </section>
  );
}

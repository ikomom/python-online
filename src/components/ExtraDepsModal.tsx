import { Button, Input, Modal, Select, Space, Tag, Typography } from "antd";
import { useCallback, useMemo, useState } from "react";

type PresetOption = { label: string; value: string };

const PRESETS: PresetOption[] = [
  { label: "numpy", value: "numpy" },
  { label: "pandas", value: "pandas" },
  { label: "matplotlib", value: "matplotlib" },
  { label: "sympy", value: "sympy" },
  { label: "scipy", value: "scipy" },
  { label: "requests", value: "requests" },
];

function parsePackageInput(text: string): string[] {
  return text
    .split(/[\n,]+/g)
    .map((v) => v.trim())
    .filter(Boolean);
}

function packageKey(pkg: string): string {
  if (/^https?:\/\//i.test(pkg)) return pkg;
  return pkg.toLowerCase();
}

export default function ExtraDepsModal(props: {
  open: boolean;
  loading: boolean;
  basePackages: string[];
  loadedPackages: string[];
  onClose: () => void;
  onLoad: (packages: string[]) => void;
}) {
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState("");

  const baseKeySet = useMemo(() => {
    const set = new Set<string>();
    for (const p of props.basePackages) set.add(packageKey(String(p)));
    return set;
  }, [props.basePackages]);

  const loadedKeySet = useMemo(() => {
    const set = new Set<string>(baseKeySet);
    for (const p of props.loadedPackages) set.add(packageKey(String(p)));
    return set;
  }, [baseKeySet, props.loadedPackages]);

  const presetOptions = useMemo(
    () =>
      PRESETS.map((p) => ({
        ...p,
        disabled: loadedKeySet.has(packageKey(p.value)),
      })),
    [loadedKeySet],
  );

  const pendingPackages = useMemo(() => {
    const manual = parsePackageInput(manualInput);
    const merged = [...selectedPresets, ...manual];
    const uniq: string[] = [];
    const seen = new Set<string>();
    for (const p of merged) {
      const key = p.trim();
      if (!key) continue;
      const normalized = packageKey(key);
      if (seen.has(normalized)) continue;
      if (loadedKeySet.has(normalized)) continue;
      seen.add(normalized);
      uniq.push(key);
    }
    return uniq;
  }, [loadedKeySet, manualInput, selectedPresets]);

  const handleLoad = useCallback(() => {
    if (pendingPackages.length === 0) return;
    props.onLoad(pendingPackages);
  }, [pendingPackages, props]);

  const handleClose = useCallback(() => {
    if (props.loading) return;
    props.onClose();
  }, [props]);

  const canLoad = pendingPackages.length > 0 && !props.loading;

  return (
    <Modal
      title="加载额外依赖"
      open={props.open}
      onCancel={handleClose}
      footer={null}
      destroyOnClose={false}
      maskClosable={!props.loading}
    >
      <div className="flex flex-col gap-3">
        <Typography.Text type="secondary" className="text-xs">
          优先尝试从 Pyodide CDN 加载；如果无法找到，会回退到 micropip
          安装（支持 URL/whl）。
        </Typography.Text>

        <div className="flex flex-col md:flex-row gap-3 min-h-0">
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Typography.Text className="text-xs font-semibold">
                常用依赖
              </Typography.Text>
              <Select
                mode="multiple"
                size="middle"
                value={selectedPresets}
                options={presetOptions}
                placeholder="选择要加载的依赖"
                onChange={setSelectedPresets}
                disabled={props.loading}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Typography.Text className="text-xs font-semibold">
                手动输入
              </Typography.Text>
              <Input.TextArea
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder={
                  "一行一个（或逗号分隔）\n例如：\nregex\nhttps://.../some.whl"
                }
                autoSize={{ minRows: 3, maxRows: 10 }}
                disabled={props.loading}
              />
            </div>
          </div>

          <div className="w-full md:w-[280px] shrink-0 flex flex-col gap-2">
            <Typography.Text className="text-xs font-semibold">
              已加载
            </Typography.Text>
            <div className="border border-black/10 rounded p-2 min-h-[120px] max-h-[260px] overflow-auto">
              {props.basePackages.length === 0 &&
              props.loadedPackages.length === 0 ? (
                <div className="text-black/45 text-xs">暂无</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {props.basePackages.length > 0 ? (
                    <div>
                      <div className="text-[11px] text-black/45 mb-1">
                        Pyodide 内置
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {props.basePackages.map((p) => (
                          <Tag key={`base:${p}`} color="blue" className="m-0">
                            {p}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {props.loadedPackages.length > 0 ? (
                    <div>
                      <div className="text-[11px] text-black/45 mb-1">
                        额外加载
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {props.loadedPackages.map((p) => (
                          <Tag key={`extra:${p}`} color="green" className="m-0">
                            {p}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Space size={8}>
            <Button onClick={handleClose} disabled={props.loading}>
              取消
            </Button>
            <Button
              type="primary"
              onClick={handleLoad}
              disabled={!canLoad}
              loading={props.loading}
            >
              加载
            </Button>
          </Space>
        </div>
      </div>
    </Modal>
  );
}

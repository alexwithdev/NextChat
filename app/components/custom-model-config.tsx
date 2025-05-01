import { useState, useEffect } from "react";
import styles from "./custom-model-config.module.scss";
import Locale from "../locales";
import { List, ListItem, Input, Select, showToast } from "./ui-lib";
import { IconButton } from "./button";
import AddIcon from "../icons/add.svg";
import CloseIcon from "../icons/close.svg";
import EditIcon from "../icons/edit.svg";
import ConfirmIcon from "../icons/confirm.svg";
import CancelIcon from "../icons/cancel.svg";
import ToggleIcon from "../icons/eye.svg";

type ModelAction = "add" | "hide";
type ProviderType = undefined;

interface CustomModelItem {
  action: ModelAction;
  modelName: string;
  displayName?: string;
  deploymentName?: string;
  provider?: ProviderType;
}

export function CustomModelConfig({
  customModels,
  onChange,
}: {
  customModels: string;
  onChange: (value: string) => void;
}) {
  // 解析自定义模型配置字符串
  const parseCustomModels = (input: string): CustomModelItem[] => {
    if (!input) return [];

    return input
      .split(",")
      .filter(Boolean)
      .map((item) => {
        // 处理 -all, +all 特殊情况
        if (item === "-all") {
          return { action: "hide", modelName: "all" };
        } else if (item === "+all") {
          return { action: "add", modelName: "all" };
        }

        // 处理添加/隐藏模型
        const action = item.startsWith("+")
          ? "add"
          : item.startsWith("-")
          ? "hide"
          : "add";
        const modelName = item.replace(/^[+-]/, "");

        return {
          action,
          modelName,
        };
      });
  };

  // 将模型配置对象转换回字符串
  const generateCustomModelsString = (models: CustomModelItem[]): string => {
    return models
      .map((model) => {
        if (model.action === "add" && model.modelName === "all") {
          return "+all";
        } else if (model.action === "hide" && model.modelName === "all") {
          return "-all";
        } else if (model.action === "add") {
          return `+${model.modelName}`;
        } else {
          return `-${model.modelName}`;
        }
      })
      .join(",");
  };

  const [items, setItems] = useState<CustomModelItem[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newItem, setNewItem] = useState<CustomModelItem>({
    action: "add",
    modelName: "",
  });
  const [useTextMode, setUseTextMode] = useState<boolean>(false);
  const [textValue, setTextValue] = useState<string>(customModels);

  // 当 customModels 变化时解析字符串
  useEffect(() => {
    setItems(parseCustomModels(customModels));
    setTextValue(customModels);
  }, [customModels]);

  // 当文本模式值变化时更新
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setTextValue(newValue);
    // 修改为不实时更新，等用户点击确认按钮时才更新
  };

  // 确认文本编辑
  const confirmTextEdit = () => {
    onChange(textValue);
  };

  const handleAdd = () => {
    // 验证输入
    if (!newItem.modelName.trim()) {
      showToast(Locale.Settings.CustomModelConfig.EmptyModelName);
      return;
    }

    // 添加新项目
    const updatedItems = [...items, { ...newItem }];
    setItems(updatedItems);
    onChange(generateCustomModelsString(updatedItems));

    // 重置新项目表单
    setNewItem({
      action: "add",
      modelName: "",
      displayName: undefined,
      deploymentName: undefined,
      provider: undefined,
    });
  };

  const handleDelete = (index: number) => {
    const updatedItems = [...items];
    updatedItems.splice(index, 1);
    setItems(updatedItems);
    onChange(generateCustomModelsString(updatedItems));
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
  };

  const handleSaveEdit = (index: number, item: CustomModelItem) => {
    const updatedItems = [...items];
    updatedItems[index] = item;
    setItems(updatedItems);
    onChange(generateCustomModelsString(updatedItems));
    setEditingIndex(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
  };

  const actionOptions = [
    { value: "add", label: Locale.Settings.CustomModelConfig.Actions.Add },
    { value: "hide", label: Locale.Settings.CustomModelConfig.Actions.Hide },
  ];

  return (
    <div className={styles["custom-model-config"]}>
      <div className={styles["config-header"]}>
        <div className={styles["mode-toggle"]}>
          <IconButton
            icon={<ToggleIcon />}
            text={
              useTextMode
                ? Locale.Settings.CustomModelConfig.VisualMode
                : Locale.Settings.CustomModelConfig.TextMode
            }
            onClick={() => setUseTextMode(!useTextMode)}
            bordered
          />
        </div>
      </div>

      {useTextMode ? (
        <div className={styles["text-mode"]}>
          <textarea
            className={styles["text-input"]}
            value={textValue}
            onChange={handleTextChange}
            placeholder={Locale.Settings.CustomModelConfig.TextPlaceholder}
          />
          <div className={styles["text-actions"]}>
            <IconButton
              icon={<ConfirmIcon />}
              text={Locale.Settings.CustomModelConfig.Confirm}
              onClick={confirmTextEdit}
              bordered
            />
          </div>
        </div>
      ) : (
        <>
          <div className={styles["items-container"]}>
            {items.length === 0 ? (
              <div className={styles["no-items"]}>
                {Locale.Settings.CustomModelConfig.NoItems}
              </div>
            ) : (
              <List>
                {items.map((item, index) => (
                  <ListItem key={index} className={styles["model-item"]}>
                    {editingIndex === index ? (
                      <div className={styles["edit-form"]}>
                        <Select
                          value={item.action}
                          onChange={(e) => {
                            const newAction = e.target.value as ModelAction;
                            const updatedItem = {
                              ...item,
                              action: newAction,
                            };
                            handleSaveEdit(index, updatedItem);
                          }}
                        >
                          {actionOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>

                        <Input
                          value={item.modelName}
                          placeholder={
                            Locale.Settings.CustomModelConfig
                              .ModelNamePlaceholder
                          }
                          className={styles["model-name-input"]}
                          onChange={(e) => {
                            const updatedItem = {
                              ...item,
                              modelName: e.currentTarget.value,
                            };
                            handleSaveEdit(index, updatedItem);
                          }}
                        />

                        <div className={styles["edit-actions"]}>
                          <IconButton
                            icon={<ConfirmIcon />}
                            onClick={() => handleSaveEdit(index, item)}
                          />
                          <IconButton
                            icon={<CancelIcon />}
                            onClick={handleCancelEdit}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className={styles["view-item"]}>
                        <div className={styles["item-content"]}>
                          <span className={styles["item-action"]}>
                            {
                              actionOptions.find(
                                (option) => option.value === item.action,
                              )?.label
                            }
                          </span>
                          <span className={styles["item-model"]}>
                            {item.modelName}
                          </span>
                        </div>
                        <div className={styles["item-actions"]}>
                          <IconButton
                            icon={<EditIcon />}
                            onClick={() => handleStartEdit(index)}
                          />
                          <IconButton
                            icon={<CloseIcon />}
                            onClick={() => handleDelete(index)}
                          />
                        </div>
                      </div>
                    )}
                  </ListItem>
                ))}
              </List>
            )}
          </div>

          <div className={styles["add-form"]}>
            <Select
              value={newItem.action}
              onChange={(e) => {
                const newAction = e.target.value as ModelAction;
                setNewItem({
                  ...newItem,
                  action: newAction,
                });
              }}
            >
              {actionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

            <Input
              value={newItem.modelName}
              placeholder={
                Locale.Settings.CustomModelConfig.ModelNamePlaceholder
              }
              onChange={(e) =>
                setNewItem({ ...newItem, modelName: e.currentTarget.value })
              }
            />

            <IconButton
              icon={<AddIcon />}
              text={Locale.Settings.CustomModelConfig.Add}
              onClick={handleAdd}
            />
          </div>
        </>
      )}
    </div>
  );
}

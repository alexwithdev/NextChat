import * as React from "react";

import styles from "./button.module.scss";
import { CSSProperties } from "react";
import clsx from "clsx";

export type ButtonType = "primary" | "danger" | null;

export function IconButton(props: {
  onClick?: () => unknown;
  icon?: JSX.Element;
  type?: ButtonType;
  text?: string;
  bordered?: boolean;
  shadow?: boolean;
  className?: string;
  title?: string;
  disabled?: boolean;
  tabIndex?: number;
  autoFocus?: boolean;
  style?: CSSProperties;
  aria?: string;
  // 等待时间，单位ms，默认100ms
  wait?: number;
}) {
  const [isLoading, setIsLoading] = React.useState(false);
  const loadingTimerRef = React.useRef<number | null>(null);

  const handleClick = () => {
    if (!props.onClick) return;

    const result = props.onClick();

    if (result instanceof Promise) {
      // 清除可能存在的旧定时器
      if (loadingTimerRef.current !== null) {
        clearTimeout(loadingTimerRef.current);
      }

      // 如果Promise在[wait]ms后仍未完成，则显示loading状态
      loadingTimerRef.current = window.setTimeout(() => {
        setIsLoading(true);
        loadingTimerRef.current = null;
      }, props.wait ?? 100);

      result.finally(() => {
        // 如果Promise完成时，定时器还存在（说明不到[wait]ms就完成了）
        if (loadingTimerRef.current !== null) {
          clearTimeout(loadingTimerRef.current);
          loadingTimerRef.current = null;
        }
        setIsLoading(false);
      });
    }
  };

  // 组件卸载时清除定时器
  React.useEffect(() => {
    return () => {
      if (loadingTimerRef.current !== null) {
        clearTimeout(loadingTimerRef.current);
      }
    };
  }, []);

  return (
    <button
      className={clsx(
        "clickable",
        styles["icon-button"],
        {
          [styles.border]: props.bordered,
          [styles.shadow]: props.shadow,
        },
        styles[props.type ?? ""],
        props.className,
      )}
      onClick={handleClick}
      title={props.title}
      disabled={props.disabled || isLoading}
      role="button"
      tabIndex={props.tabIndex}
      autoFocus={props.autoFocus}
      style={props.style}
      aria-label={props.aria}
    >
      {props.icon && !isLoading && (
        <div
          aria-label={props.text || props.title}
          className={clsx(styles["icon-button-icon"], {
            "no-dark": props.type === "primary",
          })}
        >
          {props.icon}
        </div>
      )}

      {isLoading && (
        <div
          aria-label="加载中"
          className={clsx(styles["icon-button-icon"], {
            "no-dark": props.type === "primary",
          })}
        >
          <svg
            className={styles["loading-icon"]}
            viewBox="0 0 1024 1024"
            width="16"
            height="16"
          >
            <path
              d="M512 64c-247.4 0-448 200.6-448 448s200.6 448 448 448 448-200.6 448-448-200.6-448-448-448zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z"
              fill="#e6e6e6"
            />
            <path
              d="M512 140c-205.4 0-372 166.6-372 372h72c0-165.4 134.6-300 300-300v-72z"
              fill="currentColor"
            />
          </svg>
        </div>
      )}

      {props.text && (
        <div
          aria-label={props.text || props.title}
          className={styles["icon-button-text"]}
        >
          {props.text}
        </div>
      )}
    </button>
  );
}

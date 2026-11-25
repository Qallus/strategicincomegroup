"use client";

import { FeedList } from "./notifications";
import type { WidgetProps } from "./shell";

export default function AlertsWidget(props: WidgetProps) {
  return <FeedList {...props} alerts />;
}

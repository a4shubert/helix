export type HeaderClock = {
  label: string;
  timeZone: string;
};

export type HeaderLink = {
  label: string;
  href: string;
};

export const headerTitle = "Helix: Quant Trading System";
export const headerUserLabel = "user: ashubert";
export const headerDocumentationLink: HeaderLink = {
  label: "Documentation",
  href: "about:blank",
};

export const headerApiLinks: HeaderLink[] = [
  { label: "RestSwagger", href: "about:blank" },
  { label: "RabbitMQ UI", href: "about:blank" },
  { label: "Kafka UI", href: "about:blank" },
];

export const headerClocks: HeaderClock[] = [
  { label: "New York", timeZone: "America/New_York" },
  { label: "London", timeZone: "Europe/London" },
  { label: "Dubai", timeZone: "Asia/Dubai" },
  { label: "Hong Kong", timeZone: "Asia/Hong_Kong" },
];

export type Holding = { ticker: string; weight: number };

export type Portfolio = {
  id: string;
  name: string;
  description?: string;
  holdings: Holding[];
  benchmark?: string;
};

export type PriceSeries = {
  ticker: string;
  currency?: string;
  dates: string[]; // ISO yyyy-mm-dd
  closes: number[]; // adjusted close
  error?: string;
};

export type PricesResponse = {
  range: string;
  series: PriceSeries[];
};

# TidyEDGAR: Streamlined Access to EDGAR's Financial Data
TidyEDGAR is an R package designed to simplify acquiring and transforming fundamental financial data from the EDGAR database. Leveraging the official S.E.C. API, TidyEDGAR outputs data in a clean, 'tidy' format ideal for financial analysis and stock screening based on fundamental data.

## Features
 - Ease of Use: Automates the retrieval and preprocessing of financial data.
 - Tidy Format: Structures data in a convenient format for analysis.
 - Comprehensive Coverage: Access data across all U.S. public companies.
 - Versatile Analysis: Suitable for fundamental analysis and stock screening.

## Installation
Install TidyEDGAR directly from GitHub using:

```
devtools::install_github("gerardgimenezadsuar/tidyedgar")
```

## Usage
### Fetching the latest (2020-2023) yearly financial data:
```
net_income <- get_ydata(account = "NetIncomeLoss")
revenue <- get_ydata(account = "Revenues")
op_income <- get_ydata(account = "OperatingIncomeLoss")
```

### Data Processing
#### Transform and analyze the data with additional metrics such as net margin and year-over-year changes:

```
yearly <- prepare_data(revenue, net_income, op_income, quarterly = F)
```

Leverage the power of TidyEDGAR to gain insights from financial data efficiently.

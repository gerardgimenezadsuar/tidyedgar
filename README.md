# TidyEDGAR: Streamlined Access to EDGAR's Financial Data
TidyEDGAR is an R package designed to simplify acquiring and transforming fundamental financial data from the EDGAR database. Leveraging the official S.E.C. API, TidyEDGAR outputs data in a clean, 'tidy' format ideal for financial analysis and stock screening based on fundamental data.

## Features
 - Ease of Use: Automates the retrieval and preprocessing of financial data.
 - Tidy Format: Structures data in a convenient format for analysis.
 - Comprehensive Coverage: Access data across all U.S. public companies.
 - Versatile Analysis: Suitable for fundamental analysis and stock screening.

## Installation
Install TidyEDGAR directly from GitHub using:

`install_github("gerardgimenezadsuar/tidyedgar")`

## Usage
### Fetching Data: Retrieve the latest quarterly financial data:

`revenue <- get_qdata(account = "Revenues", years = 2020:2023, quarters = c("Q1", "Q2", "Q3", "Q4"))`
### Data Processing: Transform and analyze the data with additional metrics such as net margin and quarter-over-quarter changes:

`rev_processed <- prepare_qdata(revenue)`

Leverage the power of TidyEDGAR to gain insights from financial data efficiently.

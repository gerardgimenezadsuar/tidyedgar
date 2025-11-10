#' Get complete balance sheet data for all companies in bulk
#'
#' @param years A sequence of numeric values representing the years.
#' @param quarterly Boolean indicating if quarterly data should be retrieved instead of yearly.
#' @param quarters If quarterly=TRUE, a vector of quarters (e.g., c("Q1", "Q2", "Q3", "Q4")).
#' @import dplyr
#' @import httr
#' @import jsonlite
#' @returns A dataframe with complete balance sheet items for all companies
#' @export
#' @examples
#' \donttest{get_balance_sheet(years = 2022:2023)}

get_balance_sheet <- function(years = 2020:2023, quarterly = FALSE, quarters = c("Q1", "Q2", "Q3", "Q4")) {
  message("--------------------------------------")
  message("-- Getting Balance Sheet Data (Bulk)")
  message("-- May take ~1-2 minutes")
  message("--------------------------------------")

  if(quarterly){
    message("-- Getting Assets (quarterly)")
    assets <- get_qdata(account = "Assets", years = years, quarters = quarters)
    message("-- Getting Current Assets (quarterly)")
    cur_assets <- get_qdata(account = "AssetsCurrent", years = years, quarters = quarters)
    message("-- Getting Cash (quarterly)")
    cash <- get_qdata(account = "CashAndCashEquivalentsAtCarryingValue", years = years, quarters = quarters)
    message("-- Getting Liabilities (quarterly)")
    liab <- get_qdata(account = "Liabilities", years = years, quarters = quarters)
    message("-- Getting Current Liabilities (quarterly)")
    cur_liab <- get_qdata(account = "LiabilitiesCurrent", years = years, quarters = quarters)
    message("-- Getting Long-term Debt (quarterly)")
    lt_debt <- get_qdata(account = "LongTermDebt", years = years, quarters = quarters)
    message("-- Getting Stockholders Equity (quarterly)")
    equity <- get_qdata(account = "StockholdersEquity", years = years, quarters = quarters)

    message("-- Preparing balance sheet")
    result <- prepare_data(assets, cur_assets, cash, liab, cur_liab, lt_debt, equity, quarterly = TRUE)
  } else {
    message("-- Getting Assets")
    assets <- get_ydata(account = "Assets", years = years)
    message("-- Getting Current Assets")
    cur_assets <- get_ydata(account = "AssetsCurrent", years = years)
    message("-- Getting Cash")
    cash <- get_ydata(account = "CashAndCashEquivalentsAtCarryingValue", years = years)
    message("-- Getting Liabilities")
    liab <- get_ydata(account = "Liabilities", years = years)
    message("-- Getting Current Liabilities")
    cur_liab <- get_ydata(account = "LiabilitiesCurrent", years = years)
    message("-- Getting Long-term Debt")
    lt_debt <- get_ydata(account = "LongTermDebt", years = years)
    message("-- Getting Stockholders Equity")
    equity <- get_ydata(account = "StockholdersEquity", years = years)

    message("-- Preparing balance sheet")
    result <- prepare_data(assets, cur_assets, cash, liab, cur_liab, lt_debt, equity, quarterly = FALSE)
  }

  message(paste0("Got balance sheet data for ", length(unique(result$data.cik)), " companies"))
  return(result)
}

#' Get complete income statement data for all companies in bulk
#'
#' @param years A sequence of numeric values representing the years.
#' @param quarterly Boolean indicating if quarterly data should be retrieved instead of yearly.
#' @param quarters If quarterly=TRUE, a vector of quarters (e.g., c("Q1", "Q2", "Q3", "Q4")).
#' @import dplyr
#' @import httr
#' @import jsonlite
#' @returns A dataframe with complete income statement items for all companies
#' @export
#' @examples
#' \donttest{get_income_statement(years = 2022:2023)}

get_income_statement <- function(years = 2020:2023, quarterly = FALSE, quarters = c("Q1", "Q2", "Q3", "Q4")) {
  message("--------------------------------------")
  message("-- Getting Income Statement Data (Bulk)")
  message("-- May take ~1-2 minutes")
  message("--------------------------------------")

  if(quarterly){
    message("-- Getting Revenue (quarterly)")
    rev <- get_qdata(account = "Revenues", years = years, quarters = quarters)
    message("-- Getting Cost of Revenue (quarterly)")
    cor <- get_qdata(account = "CostOfRevenue", years = years, quarters = quarters)
    message("-- Getting Gross Profit (quarterly)")
    gp <- get_qdata(account = "GrossProfit", years = years, quarters = quarters)
    message("-- Getting Operating Expenses (quarterly)")
    opex <- get_qdata(account = "OperatingExpenses", years = years, quarters = quarters)
    message("-- Getting Operating Income (quarterly)")
    oi <- get_qdata(account = "OperatingIncomeLoss", years = years, quarters = quarters)
    message("-- Getting Interest Expense (quarterly)")
    int_exp <- get_qdata(account = "InterestExpense", years = years, quarters = quarters)
    message("-- Getting Income Before Tax (quarterly)")
    ebt <- get_qdata(account = "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest", years = years, quarters = quarters)
    message("-- Getting Income Tax Expense (quarterly)")
    tax <- get_qdata(account = "IncomeTaxExpenseBenefit", years = years, quarters = quarters)
    message("-- Getting Net Income (quarterly)")
    ni <- get_qdata(account = "NetIncomeLoss", years = years, quarters = quarters)
    message("-- Getting EPS (quarterly)")
    eps <- get_qdata(account = "EarningsPerShareBasic", years = years, quarters = quarters)

    message("-- Preparing income statement")
    result <- prepare_data(rev, cor, gp, opex, oi, int_exp, ebt, tax, ni, eps, quarterly = TRUE)
  } else {
    message("-- Getting Revenue")
    rev <- get_ydata(account = "Revenues", years = years)
    message("-- Getting Cost of Revenue")
    cor <- get_ydata(account = "CostOfRevenue", years = years)
    message("-- Getting Gross Profit")
    gp <- get_ydata(account = "GrossProfit", years = years)
    message("-- Getting Operating Expenses")
    opex <- get_ydata(account = "OperatingExpenses", years = years)
    message("-- Getting Operating Income")
    oi <- get_ydata(account = "OperatingIncomeLoss", years = years)
    message("-- Getting Interest Expense")
    int_exp <- get_ydata(account = "InterestExpense", years = years)
    message("-- Getting Income Before Tax")
    ebt <- get_ydata(account = "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest", years = years)
    message("-- Getting Income Tax Expense")
    tax <- get_ydata(account = "IncomeTaxExpenseBenefit", years = years)
    message("-- Getting Net Income")
    ni <- get_ydata(account = "NetIncomeLoss", years = years)
    message("-- Getting EPS")
    eps <- get_ydata(account = "EarningsPerShareBasic", years = years, unit = "USD-per-shares")

    message("-- Preparing income statement")
    result <- prepare_data(rev, cor, gp, opex, oi, int_exp, ebt, tax, ni, eps, quarterly = FALSE)
  }

  message(paste0("Got income statement data for ", length(unique(result$data.cik)), " companies"))
  return(result)
}

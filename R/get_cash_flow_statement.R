#' Get complete cash flow statement data for all companies in bulk
#'
#' @param years A sequence of numeric values representing the years.
#' @param quarterly Boolean indicating if quarterly data should be retrieved instead of yearly.
#' @param quarters If quarterly=TRUE, a vector of quarters (e.g., c("Q1", "Q2", "Q3", "Q4")).
#' @import dplyr
#' @import httr
#' @import jsonlite
#' @returns A dataframe with complete cash flow statement items for all companies
#' @export
#' @examples
#' \donttest{get_cash_flow_statement(years = 2022:2023)}

get_cash_flow_statement <- function(years = 2020:2023, quarterly = FALSE, quarters = c("Q1", "Q2", "Q3", "Q4")) {
  message("--------------------------------------")
  message("-- Getting Cash Flow Statement Data (Bulk)")
  message("-- May take ~1-2 minutes")
  message("--------------------------------------")

  if(quarterly){
    message("-- Getting Operating Cash Flow (quarterly)")
    ocf <- get_qdata(account = "NetCashProvidedByUsedInOperatingActivities", years = years, quarters = quarters)
    message("-- Getting Investing Cash Flow (quarterly)")
    icf <- get_qdata(account = "NetCashProvidedByUsedInInvestingActivities", years = years, quarters = quarters)
    message("-- Getting Financing Cash Flow (quarterly)")
    fcf <- get_qdata(account = "NetCashProvidedByUsedInFinancingActivities", years = years, quarters = quarters)
    message("-- Getting Capital Expenditures (quarterly)")
    capex <- get_qdata(account = "PaymentsToAcquirePropertyPlantAndEquipment", years = years, quarters = quarters)
    message("-- Getting Depreciation (quarterly)")
    dep <- get_qdata(account = "DepreciationDepletionAndAmortization", years = years, quarters = quarters)

    message("-- Preparing cash flow statement")
    result <- prepare_data(ocf, icf, fcf, capex, dep, quarterly = TRUE)
  } else {
    message("-- Getting Operating Cash Flow")
    ocf <- get_ydata(account = "NetCashProvidedByUsedInOperatingActivities", years = years)
    message("-- Getting Investing Cash Flow")
    icf <- get_ydata(account = "NetCashProvidedByUsedInInvestingActivities", years = years)
    message("-- Getting Financing Cash Flow")
    fcf <- get_ydata(account = "NetCashProvidedByUsedInFinancingActivities", years = years)
    message("-- Getting Capital Expenditures")
    capex <- get_ydata(account = "PaymentsToAcquirePropertyPlantAndEquipment", years = years)
    message("-- Getting Depreciation")
    dep <- get_ydata(account = "DepreciationDepletionAndAmortization", years = years)

    message("-- Preparing cash flow statement")
    result <- prepare_data(ocf, icf, fcf, capex, dep, quarterly = FALSE)
  }

  message(paste0("Got cash flow statement data for ", length(unique(result$data.cik)), " companies"))
  return(result)
}

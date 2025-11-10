#' Calculate key financial ratios for all companies in bulk
#'
#' @param years A sequence of numeric values representing the years.
#' @param ratios Character vector of ratios to calculate. Options: "all", "roa", "roe",
#'   "current_ratio", "debt_to_equity", "asset_turnover", "free_cash_flow".
#'   Default is c("roa", "roe", "current_ratio", "debt_to_equity").
#' @import dplyr
#' @import httr
#' @import jsonlite
#' @returns A dataframe with calculated financial ratios for all companies
#' @export
#' @examples
#' \donttest{
#' # Get ROA and ROE for all companies
#' get_financial_ratios(years = 2022:2023, ratios = c("roa", "roe"))
#' }

get_financial_ratios <- function(years = 2020:2023,
                                 ratios = c("roa", "roe", "current_ratio", "debt_to_equity")) {

  if ("all" %in% ratios) {
    ratios <- c("roa", "roe", "current_ratio", "debt_to_equity", "asset_turnover", "free_cash_flow")
  }

  message("--------------------------------------")
  message("-- Calculating Financial Ratios (Bulk)")
  message(paste0("-- Ratios requested: ", paste(ratios, collapse = ", ")))
  message("-- May take ~2-3 minutes")
  message("--------------------------------------")

  # Determine what data we need based on requested ratios
  need_income <- any(c("roa", "roe", "net_margin", "asset_turnover") %in% ratios)
  need_balance <- any(c("roa", "roe", "current_ratio", "debt_to_equity", "asset_turnover") %in% ratios)
  need_cashflow <- any(c("free_cash_flow") %in% ratios)

  # Get Net Income and Revenue (needed for most ratios)
  if (need_income) {
    message("-- Getting Net Income")
    ni <- get_ydata(account = "NetIncomeLoss", years = years)
    message("-- Getting Revenue")
    rev <- get_ydata(account = "Revenues", years = years)
  }

  # Get Balance Sheet items
  if (need_balance) {
    message("-- Getting Assets")
    assets <- get_ydata(account = "Assets", years = years)
    message("-- Getting Stockholders Equity")
    equity <- get_ydata(account = "StockholdersEquity", years = years)
  }

  # Additional items for specific ratios
  if ("current_ratio" %in% ratios) {
    message("-- Getting Current Assets")
    cur_assets <- get_ydata(account = "AssetsCurrent", years = years)
    message("-- Getting Current Liabilities")
    cur_liab <- get_ydata(account = "LiabilitiesCurrent", years = years)
  }

  if ("debt_to_equity" %in% ratios) {
    message("-- Getting Liabilities")
    liab <- get_ydata(account = "Liabilities", years = years)
  }

  if ("free_cash_flow" %in% ratios) {
    message("-- Getting Operating Cash Flow")
    ocf <- get_ydata(account = "NetCashProvidedByUsedInOperatingActivities", years = years)
    message("-- Getting Capital Expenditures")
    capex <- get_ydata(account = "PaymentsToAcquirePropertyPlantAndEquipment", years = years)
  }

  # Combine all data
  message("-- Combining data...")
  all_data <- list()

  if (need_income) {
    all_data <- c(all_data, list(ni, rev))
  }
  if (need_balance) {
    all_data <- c(all_data, list(assets, equity))
  }
  if ("current_ratio" %in% ratios) {
    all_data <- c(all_data, list(cur_assets, cur_liab))
  }
  if ("debt_to_equity" %in% ratios) {
    all_data <- c(all_data, list(liab))
  }
  if ("free_cash_flow" %in% ratios) {
    all_data <- c(all_data, list(ocf, capex))
  }

  result <- do.call(prepare_data, c(all_data, list(quarterly = FALSE)))

  # Calculate ratios
  message("-- Calculating ratios...")

  if ("roa" %in% ratios && all(c("net_income", "Assets") %in% names(result))) {
    result <- result %>%
      mutate(ROA = round(.data$net_income / .data$Assets, 4))
  }

  if ("roe" %in% ratios && all(c("net_income", "StockholdersEquity") %in% names(result))) {
    result <- result %>%
      mutate(ROE = round(.data$net_income / .data$StockholdersEquity, 4))
  }

  if ("current_ratio" %in% ratios && all(c("AssetsCurrent", "LiabilitiesCurrent") %in% names(result))) {
    result <- result %>%
      mutate(current_ratio = round(.data$AssetsCurrent / .data$LiabilitiesCurrent, 4))
  }

  if ("debt_to_equity" %in% ratios && all(c("Liabilities", "StockholdersEquity") %in% names(result))) {
    result <- result %>%
      mutate(debt_to_equity = round(.data$Liabilities / .data$StockholdersEquity, 4))
  }

  if ("asset_turnover" %in% ratios && all(c("revenue", "Assets") %in% names(result))) {
    result <- result %>%
      mutate(asset_turnover = round(.data$revenue / .data$Assets, 4))
  }

  if ("free_cash_flow" %in% ratios &&
      all(c("NetCashProvidedByUsedInOperatingActivities",
            "PaymentsToAcquirePropertyPlantAndEquipment") %in% names(result))) {
    result <- result %>%
      mutate(free_cash_flow = .data$NetCashProvidedByUsedInOperatingActivities -
               abs(.data$PaymentsToAcquirePropertyPlantAndEquipment))
  }

  message(paste0("Calculated ratios for ", length(unique(result$data.cik)), " companies"))
  return(result)
}

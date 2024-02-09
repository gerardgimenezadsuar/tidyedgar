#' Getting a summary with the basic financials for all companies
#'
#' @param years A sequence of numeric values representing the years.
#' @import dplyr
#' @import httr
#' @import jsonlite
#' @returns A dataframe
#' @export
#' @examples
#' \donttest{yearly_data(years = 2022:2023)}

yearly_data <- function(years = 2020:2023){
  message("--------------------------------------")
  message("-- Starting data retrieval from EDGAR")
  message("-- May take ~30sec")
  message("--------------------------------------")
  message("-- Getting Revenue")
  rev <- get_ydata(years = years)
  message("-- Getting Operating Income")
  oi <- get_ydata(account = "OperatingIncomeLoss", years = years)
  message("-- Getting Net Income")
  ni <- get_ydata(account = "NetIncomeLoss", years = years)
  message("-- Getting Gross Profit")
  gp <- get_ydata(account = "GrossProfit", years = years)
  message("-- Tidying up the data")
  tot <- prepare_data(rev, ni, oi, gp, quarterly=FALSE)
  message(paste0("Got the financials of ", length(unique(tot$data.cik)), " companies"))
  return(tot)
}

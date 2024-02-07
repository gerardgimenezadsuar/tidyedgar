#' Getting yearly data from all public companies from EDGAR
#'
#' @param account A string representing the account (eg NetIncomeLoss, Revenues, OperatingIncomeLoss, ...)
#' @param years A sequence of numeric values representing the years.
#' @import dplyr
#' @import httr
#' @import jsonlite
#' @returns A dataframe
#' @export
#' @examples
#' get_ydata(account = "NetIncomeLoss", years = 2022:2023)

get_ydata <- function(account = "Revenues",
                      years = 2020:2023) {
  if(account == "Revenues"){
    accounts <- c("Revenues",
                  "RevenueFromContractWithCustomerExcludingAssessedTax",
                  "SalesRevenueGoodsNet",
                  "SalesRevenueNet"
    )
  }else if(account == "NetIncomeLoss"){
    accounts <- c("NetIncomeLoss",
                  "ProfitLoss")
  } else {
    accounts <- c(account)
  }

  # Create combinations of account, year
  combinations <- expand.grid(account = accounts, year = years)
  #message(paste0("-- # rows in combinations: ",nrow(combinations)))

  suppressWarnings({
    results <- lapply(1:nrow(combinations), function(i) {
      combination <- combinations[i, ]
      #message(paste("--Retrieving", combination$year, combination$account, sep = " "))
      retrieve_data(combination$account, combination$year, quarter = NA)
    })
  })


  # Combine the results
  final_data <- bind_rows(results)

  return(final_data)
}

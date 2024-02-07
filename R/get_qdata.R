#' Getting quarterly data from all public companies from EDGAR
#'
#' @param account A string representing the account (eg NetIncomeLoss, Revenues, OperatingIncomeLoss, ...)
#' @param years A sequence of numeric values representing the years.
#' @param quarters A string representing the quarter.
#' @param max_cores Boolean limiting the number of cores to 1.
#' @import dplyr
#' @import parallel
#' @import httr
#' @import jsonlite
#' @returns A dataframe
#' @export
#' @examples
#' get_qdata(account = "NetIncomeLoss", years = 2022:2023, quarters = c("Q4"))
#'

get_qdata <- function(account = "Revenues",
                      years = 2020:2023,
                      quarters = c("Q3"),
                      max_cores = TRUE) {
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


  # Create combinations of account, year, and quarter
  combinations <- expand.grid(account = accounts, year = years, quarter = quarters)
  #message(nrow(combinations))

  if(max_cores){
    no_cores <- 1
  }else{
    no_cores <- max(1, detectCores() %/% 2)
  }
  cl <- makeCluster(no_cores)

  # Load necessary libraries in each worker
  clusterEvalQ(cl, c(library(httr), library(jsonlite), library(dplyr)))

  # Export the retrieve_data function and any other required objects to the cluster
  clusterExport(cl, c("retrieve_data"))

  # Run the loop in parallel
  suppressWarnings({
    results <- parLapply(cl, 1:nrow(combinations), function(i) {
      combination <- combinations[i, ]
      #message(paste("--Retrieving", combination$year, combination$quarter, combination$account, sep = " "))
      retrieve_data(combination$account, combination$year, combination$quarter)
    })
  })

  # Stop the cluster
  suppressWarnings({
    stopCluster(cl)
  })

  # Combine the results
  final_data <- bind_rows(results)

  return(final_data)
}

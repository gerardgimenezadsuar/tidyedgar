#' Getting yearly data from all public companies in EDGAR
#'
#' @param account A string representing the account.
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
  } else {
    accounts <- c(account)
  }

  # Create combinations of account, year, and quarter
  combinations <- expand.grid(account = accounts, year = years)
  #message(paste0("-- # rows in combinations: ",nrow(combinations)))

  # if(!max_cores){
  #   no_cores <- 1
  # }else{
  #   no_cores <- max(1, detectCores() %/% 2)
  # }
  # message(paste0("-- number of cores: ", no_cores))
  # cl <- makeCluster(no_cores)
  #
  # # Load necessary libraries in each worker
  # clusterEvalQ(cl, c(library(httr), library(jsonlite), library(dplyr)))
  #
  # # Export the retrieve_data function and any other required objects to the cluster
  # clusterExport(cl, c("retrieve_data", "combinations"))

  # Run the loop in parallel
  suppressWarnings({
    results <- lapply(1:nrow(combinations), function(i) {
      combination <- combinations[i, ]
      #message(paste("--Retrieving", combination$year, combination$account, sep = " "))
      retrieve_data(combination$account, combination$year, quarter = NA)
    })
  })

  # Stop the cluster
  # suppressWarnings({
  #   stopCluster(cl)
  # })

  # Combine the results
  final_data <- bind_rows(results)

  return(final_data)
}

#' Helper function for quarterly financial data retrieval
#'
#' @param account A string representing the account.
#' @param year A numeric value representing the year.
#' @param quarter A string representing the quarter.
#' @import dplyr
#' @import httr
#' @import jsonlite
#' @returns A dataframe
#' @export

retrieve_data <- function(account, year, quarter) {
  if(!is.na(quarter)){
    url <- paste0("https://data.sec.gov/api/xbrl/frames/us-gaap/", account, "/USD/CY", year, quarter, ".json")
    response <- GET(url, user_agent("Mozilla/5.0"))
    tryCatch({
      data <- fromJSON(content(response, as = "text", encoding = "UTF-8"), flatten = TRUE)
      data$quarter <- quarter
      data$year <- year
      return(data.frame(data))
    }, error = function(e) {
      #message(paste0("Error in ",account," - ", year, "-", quarter, ": ", e$message))
      return(data.frame())
    })
  }else{
    url <- paste0("https://data.sec.gov/api/xbrl/frames/us-gaap/", account, "/USD/CY", year, ".json")
    response <- GET(url, user_agent("Mozilla/5.0"))
    tryCatch({
      data <- fromJSON(content(response, as = "text", encoding = "UTF-8"), flatten = TRUE)
      data$year <- year
      return(data.frame(data))
    }, error = function(e) {
      #message(paste0("Error in ",account," - ", year, ": ", e$message))
      return(data.frame())
    })

  }

}

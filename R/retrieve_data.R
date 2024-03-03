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
  # Input checking
  if(!is.character(account)){
    stop("Account should be a character string. e.g. NetIncomeLoss")
  }
  if(!is.numeric(year) || (year %% 1 != 0) || (year < 2000)){
    stop("Year should be a valid integer greater than 2000.")
  }
  if (!is.character(quarter) & !is.na(quarter)){
    stop("Quarter should be string representing 'Q1', 'Q2', 'Q3' or 'Q4'. For yearly data use NA")
  }

  # Add quarter to URL if it is not NA
  if(!is.na(quarter)){
    url <- paste0("https://data.sec.gov/api/xbrl/frames/us-gaap/", account, "/USD/CY", year, quarter, ".json")
  } else {
    url <- paste0("https://data.sec.gov/api/xbrl/frames/us-gaap/", account, "/USD/CY", year, ".json")
  }

  response <- GET(url, add_headers('Accept-Language' = 'en-US,en;q=0.9'), user_agent("Mozilla/5.0"))

  tryCatch({
    data <- fromJSON(content(response, as = "text", encoding = "UTF-8"), flatten = TRUE)
    if(!is.na(quarter)){
      data$quarter <- quarter
    }
    data$year <- year
    return(data.frame(data))
  }, error = function(e) {
    message(paste0("Error in ", account, " - ", year,
                   if (!is.na(quarter)) paste0("-", quarter),
                   ": ", e$message))
    return(data.frame())
  })
}

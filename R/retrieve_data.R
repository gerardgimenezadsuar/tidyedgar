#' Helper function for quarterly financial data retrieval
#'
#' @param account A string representing the account.
#' @param year A numeric value representing the year.
#' @param quarter A string representing the quarter.
#' @param taxonomy A string representing the taxonomy.
#' @param unit A string representing the units.
#' @import dplyr
#' @import httr
#' @import jsonlite
#' @returns A dataframe
#' @export

retrieve_data <- function(account, year, quarter, taxonomy = "us-gaap", unit = "USD") {
  # Input checking
  if(!is.factor(account)){
    stop("Account should be a character string. e.g. 'NetIncomeLoss'")
  }
  if(!is.numeric(year) || (year %% 1 != 0) || (year < 2000)){
    stop("Year should be a valid integer greater than 2000.")
  }
  if (!is.factor(quarter) & !is.na(quarter)){
    stop("Quarter should be string representing 'Q1', 'Q2', 'Q3' or 'Q4'. For yearly data use NA")
  }
  if (!is.character(unit) | !(unit %in% c("USD", "shares", "USD-per-shares"))){
    stop("Unit should be either 'USD', 'shares' or 'USD-per-shares'")
  }
  if(!is.character(taxonomy) | !(taxonomy %in% c("us-gaap", "dei", "ifrs-full", "srt"))){
    stop("Taxonomy should be either 'us-gaap', 'dei', 'ifrs-full' or 'srt'")
  }



  # Add quarter to URL if it is not NA
  if(!is.na(quarter)){
    url <- paste0("https://data.sec.gov/api/xbrl/frames/",taxonomy,"/", account, "/",unit,"/CY", year, quarter, ".json")
  } else {
    url <- paste0("https://data.sec.gov/api/xbrl/frames/",taxonomy,"/", account, "/",unit,"/CY", year, ".json")
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

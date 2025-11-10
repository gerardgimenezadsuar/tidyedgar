#' Screen companies across all of EDGAR based on financial criteria
#'
#' @param years A sequence of numeric values representing the years.
#' @param revenue_min Minimum revenue threshold (in USD).
#' @param revenue_max Maximum revenue threshold (in USD).
#' @param net_margin_min Minimum net profit margin (as decimal, e.g., 0.15 for 15%).
#' @param net_margin_max Maximum net profit margin (as decimal).
#' @param operating_margin_min Minimum operating margin (as decimal).
#' @param operating_margin_max Maximum operating margin (as decimal).
#' @param gross_margin_min Minimum gross margin (as decimal).
#' @param gross_margin_max Maximum gross margin (as decimal).
#' @param revenue_growth_min Minimum year-over-year revenue growth (as decimal).
#' @param revenue_growth_max Maximum year-over-year revenue growth (as decimal).
#' @param income_growth_min Minimum year-over-year net income growth (as decimal).
#' @param income_growth_max Maximum year-over-year net income growth (as decimal).
#' @param eps_min Minimum earnings per share.
#' @param eps_max Maximum earnings per share.
#' @param profitable_only If TRUE, only include companies with positive net income.
#' @param return_latest If TRUE, only return the most recent year for each company.
#' @import dplyr
#' @returns A filtered dataframe of companies meeting the criteria
#' @export
#' @examples
#' \donttest{
#' # Find large profitable companies with good margins
#' screen_companies(
#'   years = 2022:2023,
#'   revenue_min = 1e9,
#'   net_margin_min = 0.15,
#'   profitable_only = TRUE
#' )
#' }

screen_companies <- function(years = 2020:2023,
                             revenue_min = NULL,
                             revenue_max = NULL,
                             net_margin_min = NULL,
                             net_margin_max = NULL,
                             operating_margin_min = NULL,
                             operating_margin_max = NULL,
                             gross_margin_min = NULL,
                             gross_margin_max = NULL,
                             revenue_growth_min = NULL,
                             revenue_growth_max = NULL,
                             income_growth_min = NULL,
                             income_growth_max = NULL,
                             eps_min = NULL,
                             eps_max = NULL,
                             profitable_only = FALSE,
                             return_latest = FALSE) {

  message("--------------------------------------")
  message("-- Screening companies across EDGAR")
  message("-- Getting data for all companies...")
  message("--------------------------------------")

  # Get comprehensive data
  data <- yearly_data(years = years)

  message("-- Applying screening filters...")

  # Apply filters
  filtered <- data

  if (!is.null(revenue_min)) {
    filtered <- filtered %>% filter(.data$revenue >= revenue_min)
  }
  if (!is.null(revenue_max)) {
    filtered <- filtered %>% filter(.data$revenue <= revenue_max)
  }
  if (!is.null(net_margin_min)) {
    filtered <- filtered %>% filter(.data$net_margin >= net_margin_min)
  }
  if (!is.null(net_margin_max)) {
    filtered <- filtered %>% filter(.data$net_margin <= net_margin_max)
  }
  if (!is.null(operating_margin_min)) {
    filtered <- filtered %>% filter(.data$operating_margin >= operating_margin_min)
  }
  if (!is.null(operating_margin_max)) {
    filtered <- filtered %>% filter(.data$operating_margin <= operating_margin_max)
  }
  if (!is.null(gross_margin_min)) {
    filtered <- filtered %>% filter(.data$gross_margin >= gross_margin_min)
  }
  if (!is.null(gross_margin_max)) {
    filtered <- filtered %>% filter(.data$gross_margin <= gross_margin_max)
  }
  if (!is.null(revenue_growth_min)) {
    filtered <- filtered %>% filter(.data$change_R >= revenue_growth_min)
  }
  if (!is.null(revenue_growth_max)) {
    filtered <- filtered %>% filter(.data$change_R <= revenue_growth_max)
  }
  if (!is.null(income_growth_min)) {
    filtered <- filtered %>% filter(.data$change_NI >= income_growth_min)
  }
  if (!is.null(income_growth_max)) {
    filtered <- filtered %>% filter(.data$change_NI <= income_growth_max)
  }
  if (!is.null(eps_min) && "EarningsPerShareBasic" %in% names(filtered)) {
    filtered <- filtered %>% filter(.data$EarningsPerShareBasic >= eps_min)
  }
  if (!is.null(eps_max) && "EarningsPerShareBasic" %in% names(filtered)) {
    filtered <- filtered %>% filter(.data$EarningsPerShareBasic <= eps_max)
  }
  if (profitable_only) {
    filtered <- filtered %>% filter(.data$net_income > 0)
  }

  # Return only latest year if requested
  if (return_latest) {
    filtered <- filtered %>%
      group_by(.data$data.cik) %>%
      filter(.data$year == max(.data$year)) %>%
      ungroup()
  }

  message(paste0("-- Found ", length(unique(filtered$data.cik)), " companies matching criteria"))
  message(paste0("-- Total rows: ", nrow(filtered)))

  return(filtered)
}

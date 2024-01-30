#' Data wrangling for tidy fundamental data from EDGAR
#'
#' @param df A dataframe.
#' @param ... Additional dataframes passed.
#' @param quarterly Boolean indicating if quarterly data is present.
#' @import dplyr
#' @import tidyr
#' @returns A dataframe
#' @export
#' @examples
#' prepare_data(get_qdata(account = "NetIncomeLoss", years = 2022:2023, quarters = c("Q4")))

prepare_data <- function(df = NULL, quarterly = TRUE, ...) {
  if (!is.data.frame(df)) {
    stop("df must be a data frame.")
  }

  qy <- bind_rows(df, ...) %>%
    select(-.data$label, -.data$description, -.data$data.accn, -.data$pts) %>%
    pivot_wider(names_from = c("tag"), values_from = "data.val") %>%
    mutate(data.entityName = toupper(.data$data.entityName))

  # Efficient Revenue Calculation
  revenue_cols <- names(qy)[grepl("Revenue", names(qy)) & !grepl("Cost of Revenue", names(qy))]
  qy$revenue <- apply(qy[revenue_cols], 1, safe_max, na.rm=T)

  # Pre-check for column existence
  required_cols <- c("NetIncomeLoss", "revenue", "OperatingIncomeLoss")
  existing_cols <- required_cols[required_cols %in% names(qy)]


  if(quarterly){
    # Data Processing for quarterly data
    qy <- qy %>%
      select(any_of(c("data.cik", "data.entityName", "ccp", "year", "quarter", existing_cols))) %>%
      arrange(.data$data.entityName, .data$year, .data$quarter) %>%
      group_by(.data$data.cik, .data$quarter) %>%
      mutate(
        qoq_change_NI = if("NetIncomeLoss" %in% existing_cols) (.data$NetIncomeLoss - lag(.data$NetIncomeLoss)) / abs(lag(.data$NetIncomeLoss)) else NA,
        qoq_change_R = if("revenue" %in% existing_cols) (.data$revenue - lag(.data$revenue)) / abs(lag(.data$revenue)) else NA,
        qoq_change_OI = if("OperatingIncomeLoss" %in% existing_cols) (.data$OperatingIncomeLoss - lag(.data$OperatingIncomeLoss)) / abs(lag(.data$OperatingIncomeLoss)) else NA,
        qoq_change_R = ifelse(is.infinite(.data$qoq_change_R), 0, .data$qoq_change_R),
        operating_margin = if("OperatingIncomeLoss" %in% existing_cols & "revenue" %in% existing_cols) round(.data$OperatingIncomeLoss / .data$revenue, 4) else NA,
        net_margin = if("NetIncomeLoss" %in% existing_cols & "revenue" %in% existing_cols) round(.data$NetIncomeLoss / .data$revenue, 4) else NA
      ) %>%
      ungroup()

    return(qy)
  }else{
    # Data Processing for yearly data
    qy <- qy %>%
      select(any_of(c("data.cik", "data.entityName", "ccp", "year", existing_cols))) %>%
      arrange(.data$data.entityName, .data$year) %>%
      group_by(.data$data.cik) %>%
      mutate(
        qoq_change_NI = if("NetIncomeLoss" %in% existing_cols) (.data$NetIncomeLoss - lag(.data$NetIncomeLoss)) / abs(lag(.data$NetIncomeLoss)) else NA,
        qoq_change_R = if("revenue" %in% existing_cols) (.data$revenue - lag(.data$revenue)) / abs(lag(.data$revenue)) else NA,
        qoq_change_OI = if("OperatingIncomeLoss" %in% existing_cols) (.data$OperatingIncomeLoss - lag(.data$OperatingIncomeLoss)) / abs(lag(.data$OperatingIncomeLoss)) else NA,
        qoq_change_R = ifelse(is.infinite(.data$qoq_change_R), 0, .data$qoq_change_R),
        operating_margin = if("OperatingIncomeLoss" %in% existing_cols & "revenue" %in% existing_cols) round(.data$OperatingIncomeLoss / .data$revenue, 4) else NA,
        net_margin = if("NetIncomeLoss" %in% existing_cols & "revenue" %in% existing_cols) round(.data$NetIncomeLoss / .data$revenue, 4) else NA
      ) %>%
      ungroup()

    return(qy)


  }
}

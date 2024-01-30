#' Data wrangling for tidy fundamental data from EDGAR
#'
#' @param df A dataframe, output from get_qdata() or get_ydata().
#' @param ... Additional dataframes to be combined from other accounts (NetIncomeLoss, OperatingIncomeLoss, etc).
#' @param quarterly Boolean indicating if quarterly data is present.
#' @import dplyr
#' @import tidyr
#' @returns A dataframe
#' @export
#' @examples
#' revenue <- data.frame(
#'taxonomy = rep("us-gaap", 3),
#'tag = rep("Revenues", 3),
#'ccp = rep("CY2020", 3),
#'uom = rep("USD", 3),
#'label = rep("Revenues", 3),
#'description = rep("Amount of revenue recognized from goods sold, services rendered, ...", 3),
#'pts = rep(2762, 3),
#'data.accn = c("0001564590-22-012597", "0000002178-23-000038", "0001654954-22-005679"),
#'data.cik = c(2098, 2178, 2186),
#'data.entityName = c("ACME CORP", "ADAMS RESOURCES, INC.", "BK TECHNOLOGIES"),
#'data.loc = c("US-CT", "US-TX", "US-FL"),
#'data.start = rep("2020-01-01", 3),
#'data.end = rep("2020-12-31", 3),
#'data.val = c(164003040, 1022422000, 44139000),
#'year = rep(2020, 3))
#'netincome <- data.frame(
#'taxonomy = rep("us-gaap", 3),
#'tag = rep("NetIncomeLoss", 3),
#'ccp = rep("CY2020", 3),
#'uom = rep("USD", 3),
#'label = rep("NetIncomeLoss", 3),
#'description = rep("Net Income from operating activities", 3),
#'pts = rep(2762, 3),
#'data.accn = c("0001564590-22-012597", "0000002178-23-000038", "0001654954-22-005679"),
#'data.cik = c(2098, 2178, 2186),
#'data.entityName = c("ACME CORP", "ADAMS RESOURCES, INC.", "BK TECHNOLOGIES"),
#'data.loc = c("US-CT", "US-TX", "US-FL"),
#'data.start = rep("2020-01-01", 3),
#'data.end = rep("2020-12-31", 3),
#'data.val = c(100000, 200000, 4000000),
#'year = rep(2020, 3))
#'prepare_data(revenue,netincome, quarterly = FALSE)

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
        change_NI = if("NetIncomeLoss" %in% existing_cols) (.data$NetIncomeLoss - lag(.data$NetIncomeLoss)) / abs(lag(.data$NetIncomeLoss)) else NA,
        change_R = if("revenue" %in% existing_cols) (.data$revenue - lag(.data$revenue)) / abs(lag(.data$revenue)) else NA,
        change_OI = if("OperatingIncomeLoss" %in% existing_cols) (.data$OperatingIncomeLoss - lag(.data$OperatingIncomeLoss)) / abs(lag(.data$OperatingIncomeLoss)) else NA,
        change_R = ifelse(is.infinite(.data$change_R), 0, .data$change_R),
        operating_margin = if("OperatingIncomeLoss" %in% existing_cols & "revenue" %in% existing_cols) round(.data$OperatingIncomeLoss / .data$revenue, 4) else NA,
        net_margin = if("NetIncomeLoss" %in% existing_cols & "revenue" %in% existing_cols) round(.data$NetIncomeLoss / .data$revenue, 4) else NA
      ) %>%
      ungroup()

    return(qy)


  }
}

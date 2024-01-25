#' Safely calculating the max.
#'
#' @param x A number.
#' @param na.rm Boolean.
#' @returns A number.
#' @export
safe_max <- function(x, na.rm = FALSE) {
  if (na.rm) {
    x <- x[!is.na(x)]
  }
  if (length(x) == 0) {
    return(NA)  # or choose another value you prefer to represent the empty set case
  } else {
    return(max(x))
  }
}

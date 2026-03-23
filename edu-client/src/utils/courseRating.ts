/** avgRating + totalReviews từ API `/courseCreation/all-courses` (aggregate bảng reviews). */
export function ratingFromCourseListItem(course: {
  avgRating?: number;
  totalReviews?: number;
}): { value: number; review: number } {
  const value =
    typeof course.avgRating === "number" && !Number.isNaN(course.avgRating)
      ? course.avgRating
      : 0;
  const review =
    typeof course.totalReviews === "number" && course.totalReviews >= 0
      ? course.totalReviews
      : 0;
  return { value, review };
}

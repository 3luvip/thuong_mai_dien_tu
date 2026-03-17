export const formatVnd = (value: string | number): string => {
  const numeric =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/[^0-9]/g, ""));

  if (!Number.isFinite(numeric)) {
    return "0";
  }

  return numeric.toLocaleString("vi-VN");
};


import { render, screen } from "@testing-library/react";
import Rating from "../Course/Rating";


describe("Rating Component", () => {

  test("render rating value correctly", () => {
    render(<Rating value={4.5} review={1200} />);

    expect(screen.getByText("4.5")).toBeInTheDocument();
  });

  test("render review count", () => {
    render(<Rating value={4.2} review={500} />);

    expect(screen.getByText("(500 review)")).toBeInTheDocument();
  });

  test("render default 5 stars", () => {
    const { container } = render(<Rating value={3} review={10} />);

    const stars = container.querySelectorAll("svg");

    expect(stars.length).toBe(5);
  });

  test("render formatted review number", () => {
    render(<Rating value={4.8} review={12000} />);

    expect(screen.getByText("(12,000 review)")).toBeInTheDocument();
  });

});
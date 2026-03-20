import Footer from "../../common/Footer";
import HomeBannerAuth from "../Auth/HomeBannerAuth";
import CourseCardSlider from "../Card/CourseCardSlider";
import TopicSlider from "../Extra/TopicSlider";

function AuthenticatedHome() {
  return (
    <>
      <main>
        <HomeBannerAuth />

        {/* Không có category → link "Xem tất cả" → /courses */}
        <CourseCardSlider
          title="What to learn next"
          subtitle="Based on your recent activity"
          limit={10}
        />

        {/* Có category → link tự động: /courses?category=AI */}
        <CourseCardSlider
          title="Top courses in Artificial Intelligence (AI)"
          category="AI"
          limit={8}
        />
        <CourseCardSlider
          title="Top courses in Cybersecurity"
          category="Cybersecurity"
          limit={10}
        />
        <CourseCardSlider
          title="Top courses in Cloud Computing"
          category="Cloud Computing"
          limit={10}
        />
        <CourseCardSlider
          title="Top courses in Game Development"
          category="Game Development"
          limit={10}
        />
        <CourseCardSlider
          title="Top courses in Data Science"
          category="Data Science"
          limit={10}
        />
        <CourseCardSlider
          title="Top courses in Web Development"
          category="Web Development"
          limit={10}
        />

        {/* Ẩn nút "Xem tất cả" cho section ngắn này */}
        <CourseCardSlider
          title="Short and sweet courses for you"
          category="Web Development"
          limit={6}
          viewAllLink={false}
        />

        <TopicSlider />
      </main>
      <footer>
        <Footer />
      </footer>
    </>
  );
}

export default AuthenticatedHome;
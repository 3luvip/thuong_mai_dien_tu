import Footer from "../../common/Footer";
import HomeBannerAuth from "../Auth/HomeBannerAuth";
import CourseCardSlider from "../Card/CourseCardSlider";
import TopicSlider from "../Extra/TopicSlider";

function AuthenticatedHome() {
  return (
    <>
      <main>
        <HomeBannerAuth />
        <CourseCardSlider
          title="What to learn next"
          subtitle="Based on your recent activity"
          viewAllLink="/courses"
        />
        <CourseCardSlider
          title="Top courses in Artificial Intelligence (AI)"
          category="AI"
          limit={8}
          viewAllLink="/courses/ai"
        />
        <CourseCardSlider
          title="Top courses in Cybersecurity"
          category="Cybersecurity"
          limit={10}
          viewAllLink="/courses/cybersecurity"
        />
        <CourseCardSlider
          title="Top courses in Cloud Computing"
          category="Cloud Computing"
          limit={10}
          viewAllLink="/courses/cloud-computing"
        />
        <CourseCardSlider
          title="Top courses in Game Development"
          category="Game Development"
          limit={10}
          viewAllLink="/courses/game-development"
        />
        <CourseCardSlider
          title="Top courses in Data Science"
          category="Data Science"
          limit={10}
          viewAllLink="/courses/data-science"
        />
        <CourseCardSlider
          title="Top courses in Web Development"
          category="Web Development"
          limit={10}
          viewAllLink="/courses/web-development"
        />
        <CourseCardSlider
          title="Short and sweet courses for you"
          category="Web Development"
          limit={6}
        />
        <TopicSlider></TopicSlider>
      </main>
      <footer>
        <Footer/>
      </footer>
    </>
  );
}

export default AuthenticatedHome;

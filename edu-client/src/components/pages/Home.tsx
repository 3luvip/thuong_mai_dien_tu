import Footer from "../../common/Footer";
import TabComponent from "../../common/Tabs";
import TrendingCourse from "../Course/TopCourse";
import BusinessLeader from "../Extra/Businessleader";
import HomeReview from "../Extra/Homereview";
import SubScription from "../Extra/SubScription";
import BrandCompany from "../Home/BrandCompany";
import HomeBanner from "../Home/HomeBanner";

function Home() {
    return(
        <main>
            <HomeBanner/>
            <TabComponent/>
            <BrandCompany/>
            <TrendingCourse/>
            <SubScription/>
            <HomeReview/>
            <BusinessLeader/>
            <Footer/>
        </main>
    )
}

export default Home;
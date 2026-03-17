import "../../style/components/_brand_company.scss";

const BrandData = [
  {
    id: 1,
    img: "https://cms-images.udemycdn.com/96883mtakkm8/3E0eIh3tWHNWADiHNBmW4j/3444d1a4d029f283aa7d10ccf982421e/volkswagen_logo.svg",
  },
  {
    id: 2,
    img: "https://cms-images.udemycdn.com/96883mtakkm8/2pNyDO0KV1eHXk51HtaAAz/090fac96127d62e784df31e93735f76a/samsung_logo.svg",
  },
  {
    id: 3,
    img: "https://cms-images.udemycdn.com/96883mtakkm8/3YzfvEjCAUi3bKHLW2h1h8/ec478fa1ed75f6090a7ecc9a083d80af/cisco_logo.svg",
  },
  {
    id: 4,
    img: "https://cms-images.udemycdn.com/96883mtakkm8/23XnhdqwGCYUhfgIJzj3PM/77259d1ac2a7d771c4444e032ee40d9e/vimeo_logo_resized-2.svg",
  },
  {
    id: 5,
    img: "https://cms-images.udemycdn.com/96883mtakkm8/1UUVZtTGuvw23MwEnDPUr3/2683579ac045486a0aff67ce8a5eb240/procter_gamble_logo.svg",
  },
  {
    id: 6,
    img: "https://cms-images.udemycdn.com/96883mtakkm8/1GoAicYDYxxRPGnCpg93gi/a8b6190cc1a24e21d6226200ca488eb8/hewlett_packard_enterprise_logo.svg",
  },
  {
    id: 7,
    img: "https://cms-images.udemycdn.com/96883mtakkm8/2tQm6aYrWQzlKBQ95W00G/c7aaf002814c2cde71d411926eceaefa/citi_logo.svg",
  },
  {
    id: 8,
    img: "https://cms-images.udemycdn.com/96883mtakkm8/7guDRVYa2DZD0wD1SyxREP/b704dfe6b0ffb3b26253ec36b4aab505/ericsson_logo.svg",
  },
];

function BrandCompany() {
  return (
    <section>
      <div className="Brand-container">
        <h2>
          Trusted by over 16,000 companies and millions of learners around the
          world
        </h2>
        <div className="Brand-Partner">
          <ul className="Brand-list">
            {BrandData.map((brand) => (
              <li key={brand.id}>
                <img src={brand.img} alt="" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default BrandCompany;

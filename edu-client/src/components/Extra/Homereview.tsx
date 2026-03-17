import "../../style/components/_home_review.scss";
import { NavLink } from 'react-router-dom';

const reviews = [
  {
    id: 1,
    quote: (
      <>
        CTUET Online was rated the{' '}
        <strong>most popular online course or certification program</strong>{' '}
        for learning how to code according to{' '}
        <NavLink to="/">StackOverflow's 2023 Developer Survey.</NavLink>
      </>
    ),
    company: {
      logo: 'https://cms-images.udemycdn.com/96883mtakkm8/2PBcNgsQa3SvYWklkiN27r/5b8707cc79c8cae5774d5eb3b88b4001/logo_stackoverflow.svg',
      stat: '37,076 responses collected',
    },
    link: { to: '/', label: 'View Web Development course' },
  },
  {
    id: 2,
    quote: (
      <>
        CTUET Online was truly a{' '}
        <strong>game-changer and a great guide</strong> for me as we brought
        Dimensional to life.
      </>
    ),
    person: {
      avatar: 'https://cms-images.udemycdn.com/96883mtakkm8/1Djz6c0gZLaCG5SQS3PgUY/54b6fb8c85d8da01da95cbb94fa6335f/Alvin_Lim.jpeg',
      name: 'Alvin Lim',
      role: 'Technical Co-Founder, CTO at Dimensional',
    },
    link: { to: '/', label: 'View this iOS & Swift course' },
  },
  {
    id: 3,
    quote: (
      <>
        CTUET Online gives you the ability to be persistent. I learned exactly
        what I needed to know in the real world. It helped me sell myself to{' '}
        <strong>get a new role.</strong>
      </>
    ),
    person: {
      avatar: 'https://cms-images.udemycdn.com/96883mtakkm8/6dT7xusLHYoOUizXeVqgUk/4317f63fe25b2e07ad8c70cda641014b/William_A_Wachlin.jpeg',
      name: 'William A. Wachlin',
      role: 'Partner Account Manager at Amazon Web Services',
    },
    link: { to: '/', label: 'View this AWS course' },
  },
  {
    id: 4,
    quote: (
      <>
        With CTUET Online employees were able to marry the two together,
        technology and consultant soft skills... to help{' '}
        <strong>drive their careers forward.</strong>
      </>
    ),
    person: {
      avatar: 'https://cms-images.udemycdn.com/96883mtakkm8/4w9dYD4F64ibQwsaAB01Z4/c4610e9b1ac65589d8b1374ad10714e2/Ian_Stevens.png',
      name: 'Ian Stevens',
      role: 'Head of Capability Development, North America at Publicis Sapient',
    },
    link: { to: '/', label: 'Read full story' },
  },
];

function HomeReview() {
  return (
    <section className="rev-section">
      <div className="rev-container">

        {/* Header */}
        <div className="rev-header">
          <h2 className="rev-heading">
            See what others are achieving
            <span className="rev-heading__accent"> through learning</span>
          </h2>
        </div>

        {/* Cards grid */}
        <div className="rev-grid">
          {reviews.map((r, i) => (
            <div
              key={r.id}
              className="rev-card"
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              {/* Quote mark */}
              <div className="rev-card__quote-mark">"</div>

              {/* Quote text */}
              <p className="rev-card__text">{r.quote}</p>

              {/* Company logo block */}
              {r.company && (
                <div className="rev-card__company">
                  <img
                    src={r.company.logo}
                    alt="company logo"
                    className="rev-card__company-logo"
                  />
                  <span className="rev-card__company-stat">{r.company.stat}</span>
                </div>
              )}

              {/* Person block */}
              {r.person && (
                <div className="rev-card__person">
                  <img
                    src={r.person.avatar}
                    alt={r.person.name}
                    className="rev-card__avatar"
                  />
                  <div>
                    <p className="rev-card__name">{r.person.name}</p>
                    <p className="rev-card__role">{r.person.role}</p>
                  </div>
                </div>
              )}

              {/* CTA link */}
              <NavLink to={r.link.to} className="rev-card__link">
                {r.link.label} →
              </NavLink>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

export default HomeReview;
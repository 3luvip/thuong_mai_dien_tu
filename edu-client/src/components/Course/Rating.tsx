import React from 'react'
import { FaStar, FaStarHalfAlt, FaRegStar } from 'react-icons/fa';

interface RatingProps  {
    value : number,
    totalstar? : number;
    review? : number
}

const Rating: React.FC<RatingProps> = ({ value, totalstar = 5,review }) => {
  const stars = [];

  for (let i = 1; i <= totalstar; i++) {
    if (value >= i) {
      stars.push(<FaStar key={i} color="#f4c150" />);
    } else if (value >= i - 0.5) {
      stars.push(<FaStarHalfAlt key={i} color="#f4c150" />);
    } else {
      stars.push(<FaRegStar key={i} color="#f4c150" />);
    }
  }

  return (
     <span className="rating" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ display: 'flex' }}>{stars}</span>
      <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{value.toFixed(1)}</span>
      <span>
        ({review?.toLocaleString()} review)
      </span>
    </span>
  )

}

export default Rating;
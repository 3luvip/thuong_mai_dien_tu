src/
├── main.rs                         ← entry point gọn, chỉ setup
├── config.rs                       ← 🆕 tập trung env vars
├── state.rs                        ← AppState
├── errors.rs                       ← AppError (giữ nguyên)
│
├── config.rs                       ← 🆕 tất cả std::env::var
│
├── routes/
│   ├── mod.rs                      ← 🆕 build_router() gộp tất cả nest()
│   ├── auth.rs
│   ├── course.rs                   ← chỉ chứa course + course_card routes
│   ├── cart.rs                     ← 🆕 tách cart ra khỏi course.rs
│   ├── coupon.rs                   ← 🆕 tách coupon ra
│   ├── order.rs                    ← 🆕 tách order ra
│   ├── review.rs                   ← 🆕 tách review ra
│   ├── instructor.rs
│   ├── learning.rs
│   ├── notification.rs
│   ├── user.rs
│   └── wishlist.rs
│
├── controllers/
│   ├── mod.rs
│   ├── auth.rs
│   ├── course/
│   │   ├── mod.rs                  ← re-export
│   │   ├── create.rs               ← 🆕 create_course, create_course_card, create_course_instruction
│   │   ├── query.rs                ← 🆕 get_course, get_all_courses, get_course_cards, get_footer
│   │   └── detail.rs               ← get_course_detail_full (tách từ course_detail.rs)
│   ├── cart/
│   │   ├── mod.rs
│   │   └── handler.rs              ← 🆕 get_cart, add_to_cart, remove_from_cart, clear_cart
│   ├── coupon/
│   │   ├── mod.rs
│   │   └── handler.rs              ← 🆕 apply_coupon, confirm_coupon
│   ├── order/
│   │   ├── mod.rs
│   │   └── handler.rs              ← 🆕 checkout, get_my_orders (tách từ course_detail.rs)
│   ├── review/
│   │   ├── mod.rs
│   │   └── handler.rs              ← 🆕 create_review (tách từ course_detail.rs)
│   ├── instructor.rs
│   ├── learning.rs
│   ├── notification.rs
│   └── wishlist.rs
│ 
├── models/
│   ├── mod.rs
│   ├── user.rs
│   ├── course/
│   │   ├── mod.rs
│   │   ├── course.rs               ← Course struct
│   │   ├── course_card.rs          ← CourseCard, CreateCourseCardRequest
│   │   └── course_instruction.rs   ← CourseInstruction, CreateCourseInstructionRequest
│   ├── cart.rs                     ← Cart, AddToCartRequest, CartCourseItem
│   └── coupon.rs
│
├── services/                       ← 🆕 business logic tách khỏi controller
│   ├── mod.rs
│   ├── cron.rs                     ← start_discount_cron (chuyển từ controllers/)
│   └── upload.rs                   ← 🆕 logic xử lý file upload dùng chung
│
├── middleware/
│   ├── mod.rs
│   └── auth.rs
│
└── utils/
    └── mod.rs
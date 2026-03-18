use serde::{Deserialize};

#[derive(Debug, Deserialize)]
pub struct CreateCourseInstructionRequest {
    pub role: String,
    #[serde(rename = "Budget")]
    pub budget: String,
    #[serde(rename = "ProjectRisk")]
    pub project_risk: String,
    #[serde(rename = "CaseStudy")]
    pub case_study: String,
    #[serde(rename = "Requirement")]
    pub requirement: String,
    #[serde(rename = "AboutCourse")]
    pub about_course: String,
    pub course_detail_id: String,  // link to course
}
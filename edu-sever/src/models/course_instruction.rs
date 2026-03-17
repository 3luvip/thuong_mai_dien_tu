use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Maps to the `course_instructions` table
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CourseInstruction {
    pub id: String,
    pub role: String,
    pub budget: String,
    pub project_risk: String,
    pub case_study: String,
    pub requirement: String,
    pub about_course: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

/// Request body for creating course instruction
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
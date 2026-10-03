from pydantic import BaseModel, Field


class SchoolClassInfo(BaseModel):
    name: str
    sections: list[str]
    stream: str | None = None
    combination: str | None = None


class SubjectInfo(BaseModel):
    name: str
    code: str | None = None
    applicable_classes: list[str] = Field(default_factory=list)
    periods_per_week: int | None = None
    requires_room: str | None = None


class TeacherInfo(BaseModel):
    teacher_id: str
    name: str
    subject_specialization: list[str] = Field(default_factory=list)
    qualification: str | None = None
    max_periods_per_day: int | None = None


class PeriodSlot(BaseModel):
    label: str
    start_time: str
    end_time: str
    is_teaching_period: bool = True


class SchoolData(BaseModel):
    school_name: str
    academic_year: str
    board: str = "CBSE"
    state: str = "Andhra Pradesh"
    working_days: list[str] = Field(
        default_factory=lambda: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    )
    period_schedule: list[PeriodSlot] = Field(default_factory=list)
    classes: list[SchoolClassInfo]
    subjects: list[SubjectInfo]
    teachers: list[TeacherInfo]


class TimetableGenerateRequest(BaseModel):
    school_data: SchoolData
    provider: str | None = None
    model: str | None = None
    extra_instructions: str | None = None


class TimetableGenerateResponse(BaseModel):
    provider: str
    model: str
    raw_output: str

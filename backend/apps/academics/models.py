from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import UIDModel


class Stream(models.TextChoices):
    SCIENCE = "SCIENCE", "Science"
    COMMERCE = "COMMERCE", "Commerce"
    HUMANITIES = "HUMANITIES", "Humanities"


class Combination(models.TextChoices):
    """Finer grouping within a Class 11-12 stream. Nullable everywhere it's
    used — only meaningful for Science/Commerce/Humanities sections and
    students in Class 11-12.

    CBSE splits Science into PCM/PCB/PCMB and Commerce by its elective 5th
    subject. SSC's Intermediate instead uses the standard Andhra Pradesh
    group codes — MPC/BiPC under Science, CEC under Commerce, HEC under
    Humanities — which name a fixed subject combination rather than an
    elective, so `for_stream` returns a different list per board (see
    below)."""

    PCM = "PCM", "PCM (Physics, Chemistry, Mathematics)"
    PCB = "PCB", "PCB (Physics, Chemistry, Biology)"
    PCMB = "PCMB", "PCMB (Physics, Chemistry, Mathematics, Biology)"
    COMMERCE_MATHS = "COMMERCE_MATHS", "Commerce with Mathematics"
    COMMERCE_APPLIED_MATHS = "COMMERCE_APPLIED_MATHS", "Commerce with Applied Mathematics"
    COMMERCE_CS = "COMMERCE_CS", "Commerce with Computer Science"
    COMMERCE_IP = "COMMERCE_IP", "Commerce with Informatics Practices"
    COMMERCE_ENTREPRENEURSHIP = "COMMERCE_ENTREPRENEURSHIP", "Commerce with Entrepreneurship"
    MPC = "MPC", "MPC (Mathematics, Physics, Chemistry)"
    BIPC = "BIPC", "BiPC (Biology, Physics, Chemistry)"
    CEC = "CEC", "CEC (Civics, Economics, Commerce)"
    HEC = "HEC", "HEC (History, Economics, Civics)"

    @classmethod
    def for_stream(cls, stream, board=None):
        if board == "SSC":
            if stream == Stream.SCIENCE:
                return [cls.MPC, cls.BIPC]
            if stream == Stream.COMMERCE:
                return [cls.CEC]
            if stream == Stream.HUMANITIES:
                return [cls.HEC]
            return []
        if stream == Stream.SCIENCE:
            return [cls.PCM, cls.PCB, cls.PCMB]
        if stream == Stream.COMMERCE:
            return [
                cls.COMMERCE_MATHS, cls.COMMERCE_APPLIED_MATHS, cls.COMMERCE_CS,
                cls.COMMERCE_IP, cls.COMMERCE_ENTREPRENEURSHIP,
            ]
        return []


class LanguageTier(models.TextChoices):
    FIRST = "FIRST", "First Language"
    SECOND = "SECOND", "Second Language"
    THIRD = "THIRD", "Third Language"
    ADDITIONAL = "ADDITIONAL", "Additional Language"


class CoScholasticCategory(models.TextChoices):
    ARTS = "ARTS", "Arts"
    PERFORMING_ARTS = "PERFORMING_ARTS", "Performing Arts"
    SPORTS = "SPORTS", "Sports"
    LIFE_SKILLS = "LIFE_SKILLS", "Life Skills"
    TECHNOLOGY = "TECHNOLOGY", "Technology"


class SubjectCategory(models.TextChoices):
    MANDATORY = "MANDATORY", "Mandatory"
    OPTIONAL = "OPTIONAL", "Optional / Skill"
    CO_SCHOLASTIC = "CO_SCHOLASTIC", "Co-Scholastic"


class SchoolClass(UIDModel):
    class Level(models.TextChoices):
        LKG = "LKG", "LKG"
        UKG = "UKG", "UKG"
        CLASS_1 = "1", "Class 1"
        CLASS_2 = "2", "Class 2"
        CLASS_3 = "3", "Class 3"
        CLASS_4 = "4", "Class 4"
        CLASS_5 = "5", "Class 5"
        CLASS_6 = "6", "Class 6"
        CLASS_7 = "7", "Class 7"
        CLASS_8 = "8", "Class 8"
        CLASS_9 = "9", "Class 9"
        CLASS_10 = "10", "Class 10"
        CLASS_11 = "11", "Class 11"
        CLASS_12 = "12", "Class 12"

    class Board(models.TextChoices):
        CBSE = "CBSE", "CBSE"
        SSC = "SSC", "SSC (State Board)"

    name = models.CharField(max_length=20)
    level = models.CharField(max_length=10, choices=Level.choices)
    # A class now belongs to exactly one board, so the same level (e.g.
    # "Class 11") can exist twice — once per board — as two independent
    # SchoolClass rows with their own sections/students/staff. This is what
    # makes the 4 "divisions" (CBSE junior, CBSE senior, SSC junior, SSC
    # senior) possible; previously the school had a single board setting
    # (still on SchoolProfile) and only one row per level existed.
    board = models.CharField(max_length=10, choices=Board.choices, default=Board.CBSE)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(fields=["level", "board"], name="academics_schoolclass_level_board_uniq"),
            models.UniqueConstraint(fields=["name", "board"], name="academics_schoolclass_name_board_uniq"),
        ]

    def __str__(self):
        return self.name

    @property
    def has_streams(self):
        return self.level in ("11", "12")


class Section(UIDModel):
    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name="sections")
    name = models.CharField(max_length=20)
    stream = models.CharField(max_length=20, choices=Stream.choices, null=True, blank=True)
    combination = models.CharField(max_length=30, choices=Combination.choices, null=True, blank=True)
    class_teacher = models.ForeignKey(
        "teachers.Teacher", on_delete=models.SET_NULL, null=True, blank=True, related_name="class_teacher_of",
    )
    room = models.ForeignKey(
        "CommonRoom", on_delete=models.SET_NULL, null=True, blank=True, related_name="sections",
    )

    class Meta:
        unique_together = ("school_class", "name", "stream", "combination")

    def __str__(self):
        label = f"{self.school_class.name} - {self.name}"
        suffix = self.combination or self.stream
        return f"{label} ({suffix})" if suffix else label


class Subject(UIDModel):
    """A catalog entry (e.g. "Physics", "English"). Which classes/streams
    require it, and in what category, lives on ProfileSubject — a subject's
    category (Mandatory/Optional/Co-Scholastic) varies by class, so it isn't
    a fixed property of the subject itself."""

    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(
        max_length=20,
        blank=True,
        default="",
        help_text="Short internal subject code, e.g. MATH, EVS, PHY.",
    )
    min_level = models.CharField(
        max_length=10, choices=SchoolClass.Level.choices, null=True, blank=True,
        help_text="Lowest class this subject is taught in. Blank = no lower bound.",
    )
    max_level = models.CharField(
        max_length=10, choices=SchoolClass.Level.choices, null=True, blank=True,
        help_text="Highest class this subject is taught in. Blank = no upper bound.",
    )
    language_tier = models.CharField(max_length=20, choices=LanguageTier.choices, null=True, blank=True)
    co_scholastic_category = models.CharField(max_length=30, choices=CoScholasticCategory.choices, null=True, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class CommonRoom(UIDModel):
    """The school's room catalog, split into two kinds: a CLASS_ROOM can be
    assigned to a Section as its own home room (see Section.room); a
    COMMON_ROOM is a shared facility (Music Room, Playground, Yoga Hall, ...)
    that isn't tied to any one section."""

    class RoomType(models.TextChoices):
        CLASS_ROOM = "CLASS_ROOM", "Class Room"
        COMMON_ROOM = "COMMON_ROOM", "Common Room"

    class ClassGroup(models.TextChoices):
        JUNIOR = "JUNIOR", "Classes 1-10"
        SENIOR = "SENIOR", "11th & 12th"
        BOTH = "BOTH", "Both"

    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(
        max_length=30,
        blank=True,
        default="",
        help_text="Short abbreviated code for this room (e.g. Class-001, Ground-001, Music-Class-001).",
    )
    room_type = models.CharField(max_length=20, choices=RoomType.choices, default=RoomType.CLASS_ROOM)
    # Only meaningful for COMMON_ROOM rows — a Class Room's group is worked
    # out from whichever section it's assigned to instead (see
    # Section.room), so this field is ignored for CLASS_ROOM rows. Defaults
    # to BOTH so every Common Room that existed before this field was added
    # keeps showing up for both groups rather than disappearing from either.
    class_group = models.CharField(max_length=10, choices=ClassGroup.choices, default=ClassGroup.BOTH)
    subject = models.ForeignKey(
        "Subject",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="common_rooms",
        help_text="For Common Rooms: the subject usually taught here (e.g. Music Room -> Music). "
        "Used to auto-fill a Timetable slot's room when this subject is selected.",
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class ClassStreamProfile(UIDModel):
    """One row of the curriculum table: a specific Class (+ Stream + Combination
    when applicable) grouping that has its own Mandatory/Optional/Co-Scholastic
    subject list via ProfileSubject. A class can carry a separate curriculum per
    Board (e.g. its CBSE subject list and its SSC/state-board subject list)."""

    class Board(models.TextChoices):
        CBSE = "CBSE", "CBSE"
        SSC = "SSC", "SSC (State Board)"

    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name="stream_profiles")
    stream = models.CharField(max_length=20, choices=Stream.choices, null=True, blank=True)
    combination = models.CharField(max_length=30, choices=Combination.choices, null=True, blank=True)
    board = models.CharField(max_length=10, choices=Board.choices, default=Board.CBSE)

    class Meta:
        unique_together = ("school_class", "stream", "combination", "board")
        ordering = ["school_class__id", "stream", "combination"]

    def __str__(self):
        label = self.school_class.name
        suffix = self.combination or self.stream
        base = f"{label} - {suffix}" if suffix else label
        return f"{base} ({self.board})"


class ProfileSubject(UIDModel):
    profile = models.ForeignKey(ClassStreamProfile, on_delete=models.CASCADE, related_name="subjects")
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, related_name="profile_links")
    category = models.CharField(max_length=20, choices=SubjectCategory.choices)

    class Meta:
        unique_together = ("profile", "subject", "category")

    def __str__(self):
        return f"{self.profile} - {self.subject} ({self.category})"


class SectionSubject(UIDModel):
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name="section_subjects")
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, related_name="section_subjects")

    class Meta:
        unique_together = ("section", "subject")

    def __str__(self):
        return f"{self.section} - {self.subject}"


class Timetable(UIDModel):
    class Day(models.TextChoices):
        MONDAY = "MON", "Monday"
        TUESDAY = "TUE", "Tuesday"
        WEDNESDAY = "WED", "Wednesday"
        THURSDAY = "THU", "Thursday"
        FRIDAY = "FRI", "Friday"
        SATURDAY = "SAT", "Saturday"

    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name="timetable_slots")
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="timetable_slots")
    teacher = models.ForeignKey("teachers.Teacher", on_delete=models.CASCADE, related_name="timetable_slots")
    day_of_week = models.CharField(max_length=3, choices=Day.choices)
    period = models.PositiveSmallIntegerField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    classroom = models.CharField(max_length=50)

    MAX_DAILY_CLASSES = 5

    # How many periods per week each subject may occupy in a single section's
    # timetable — a curriculum pacing rule, independent of which teacher takes
    # it. Subjects not listed here (including every Co-Scholastic/activity
    # subject) have no weekly cap.
    WEEKLY_SUBJECT_QUOTAS = {
        "Mathematics": 5,
        "Mathematics (Standard/Basic)": 5,
        "Science": 5,
        "English": 4,
        "Hindi": 4,
        "Telugu": 4,
        "Social Science": 5,
    }

    class Meta:
        unique_together = ("section", "day_of_week", "period")

    def clean(self):
        conflict = Timetable.objects.filter(
            teacher=self.teacher,
            day_of_week=self.day_of_week,
            period=self.period,
        ).exclude(pk=self.pk)
        if conflict.exists():
            raise ValidationError("This teacher is already booked for another section in this period.")

        # Applies to every teacher regardless of role (Teacher or Class
        # Teacher) — it's a per-Teacher daily workload cap, not a role rule.
        # Extra-curricular/activity periods (SUPW, Games, Art, Music, PE,
        # Dance, Yoga, Value/Work Education, ...) — anything tagged
        # Co-Scholastic in the curriculum — never count toward it.
        co_scholastic_subject_ids = set(
            ProfileSubject.objects.filter(category=SubjectCategory.CO_SCHOLASTIC).values_list("subject_id", flat=True)
        )
        if self.subject_id not in co_scholastic_subject_ids:
            daily_count = (
                Timetable.objects.filter(teacher=self.teacher, day_of_week=self.day_of_week)
                .exclude(pk=self.pk)
                .exclude(subject_id__in=co_scholastic_subject_ids)
                .count()
            )
            if daily_count >= self.MAX_DAILY_CLASSES:
                raise ValidationError(
                    f"{self.teacher} already has {self.MAX_DAILY_CLASSES} non-co-scholastic periods on this day."
                )

        quota = self.WEEKLY_SUBJECT_QUOTAS.get(self.subject.name)
        if quota is not None:
            weekly_count = (
                Timetable.objects.filter(section=self.section, subject=self.subject).exclude(pk=self.pk).count()
            )
            if weekly_count >= quota:
                raise ValidationError(f"{self.subject} already has its full {quota} periods/week for {self.section}.")

    def __str__(self):
        return f"{self.section} - P{self.period} ({self.subject})"


class AIGenerationHistory(UIDModel):
    """A past 'Generate with AI' timetable proposal, saved so it can be reviewed
    again later without re-calling the LLM (and re-spending tokens)."""

    created_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="ai_timetable_generations",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    provider = models.CharField(max_length=20)
    model = models.CharField(max_length=100, blank=True)
    class_names = models.JSONField(default=list, blank=True)
    extra_instructions = models.TextField(blank=True)
    raw_output = models.TextField()

    class Meta:
        verbose_name = "AI Generation History"
        verbose_name_plural = "AI Generation History"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.provider} - {self.created_at:%Y-%m-%d %H:%M}"

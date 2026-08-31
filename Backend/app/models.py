from sqlalchemy import Column, Integer, String, Text, DateTime, Index
from sqlalchemy.sql import func
from .database import Base


class UploadLog(Base):
    __tablename__ = "upload_logs"
    id          = Column(Integer, primary_key=True, index=True)
    file_type   = Column(String(20))
    filename    = Column(String(255), default="")
    records     = Column(Integer, default=0)
    uploaded_at = Column(DateTime, server_default=func.now())


class ConferenceEvent(Base):
    __tablename__ = "conference_events"

    id           = Column(Integer, primary_key=True, index=True)

    date         = Column(String(10),  index=True, default="")
    time_raw     = Column(String(255), default="")
    title        = Column(Text)
    location     = Column(String(255), default="")
    app          = Column(String(255), default="")
    coordinator  = Column(String(255), default="")
    department   = Column(String(255), default="")
    book_no      = Column(String(255), default="")
    status       = Column(String(100), default="")
    assignee     = Column(String(255), default="")
    zoom_user    = Column(String(255), default="")
    details      = Column(Text,        default="")

    month_source = Column(String(50),  default="")
    source       = Column(String(20),  default="manual")
    imported_at  = Column(DateTime,    server_default=func.now())
    image_url    = Column(String(500), nullable=True)
    meeting_link = Column(String(500), nullable=True)
    deleted_at   = Column(DateTime, nullable=True)
    event_type   = Column(String(50), nullable=True)
    __table_args__ = (
        Index("ix_conference_events_title", "title", mysql_length=255),
    )
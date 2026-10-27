import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_worker_nap_du_model_trong_tien_trinh_rieng():
    """Worker Celery chạy tiến trình riêng, chỉ import module task. Phải tự nạp đủ model để giải khóa ngoại
    (lỗi này không lộ ra khi test chạy task ngay trong tiến trình API, nơi mọi model đã được import)."""
    code = (
        "from sqlalchemy.orm import configure_mappers\n"
        "import app.modules.learning.tasks\n"
        "configure_mappers()\n"
        "from app.workers.db import sync_engine\n"
        "from app.modules.learning.models import SkillScore\n"
        "print([fk.column.table.name for fk in SkillScore.__table__.foreign_keys])\n"
    )
    out = subprocess.run([sys.executable, "-c", code], cwd=ROOT, capture_output=True, text=True, timeout=60)
    assert out.returncode == 0, out.stderr[-800:]
    assert "users" in out.stdout and "skills" in out.stdout

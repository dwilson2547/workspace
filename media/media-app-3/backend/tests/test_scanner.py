from pathlib import Path
from tasks.scanner import scan_for_media


def test_scans_recursively(tmp_path):
    (tmp_path / "sub").mkdir()
    (tmp_path / "img1.jpg").touch()
    (tmp_path / "sub" / "img2.PNG").touch()
    (tmp_path / "sub" / "document.pdf").touch()  # should be excluded

    results = scan_for_media([str(tmp_path)])
    paths = [r.path for r in results]
    assert any("img1.jpg" in p for p in paths)
    assert any("img2.PNG" in p for p in paths)
    assert not any("document.pdf" in p for p in paths)


def test_accepts_individual_files(tmp_path):
    f = tmp_path / "photo.mp4"
    f.touch()
    results = scan_for_media([str(f)])
    assert len(results) == 1
    assert results[0].media_type == "video"


def test_image_and_video_types_classified(tmp_path):
    (tmp_path / "photo.jpg").touch()
    (tmp_path / "clip.mov").touch()
    (tmp_path / "ignored.pdf").touch()

    results = scan_for_media([str(tmp_path)])
    types = {r.media_type for r in results}
    assert "image" in types
    assert "video" in types
    assert len(results) == 2  # pdf excluded

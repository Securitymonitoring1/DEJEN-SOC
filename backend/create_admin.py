from backend.database.postgres import SessionLocal
from backend.models.user import User
from backend.services.auth_service import hash_password


def create_admin():
    db = SessionLocal()

    try:
        existing_user = (
            db.query(User)
            .filter(User.username == "admin")
            .first()
        )

        if existing_user:
            print("Admin user already exists.")
            return

        admin = User(
            username="admin",
            password_hash=hash_password("Admin123!"),
            role="ADMIN",
            is_active=True,
        )

        db.add(admin)
        db.commit()
        db.refresh(admin)

        print(f"Admin user created successfully. ID: {admin.id}")

    finally:
        db.close()


if __name__ == "__main__":
    create_admin()

from flask import Flask, render_template

from controllers.event_controller import event_controller
from database import create_db, db

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///example.db"
db.init_app(app)
app.register_blueprint(event_controller)

@app.route("/", methods=["GET"])
def index():
    return render_template('index.html')


if __name__ == "__main__":
    with app.app_context():
        create_db(app)

    app.run(debug=True, port=5000)
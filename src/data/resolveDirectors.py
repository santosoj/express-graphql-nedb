#!/usr/bin/env python
import csv
from sys import stdin, stdout

directors = []
films = []

with open("directors.csv", "r") as f:
  reader = csv.DictReader(f, delimiter="|", fieldnames=("_id", "name", "lexKey", "birthYear", "deathYear"))
  next(reader)
  for row in reader:
    directors.append(row)

reader = csv.DictReader(stdin, delimiter="|", fieldnames=("_id", "title", "directors", "year"))
next(reader)
for row in reader:
  director_names = row["directors"].split(",")
  director_ids = []
  for name in director_names:
    director = next(d for d in directors if d["name"] == name)
    director_ids.append(int(director["_id"]))
  row["directors"] = str(director_ids)
  films.append(row)

writer = csv.DictWriter(stdout, delimiter="|", fieldnames=("_id", "title", "directors", "year"))
writer.writeheader()
writer.writerows(films)
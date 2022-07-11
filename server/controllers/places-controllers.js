const fs = require("fs");

const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

const HttpError = require("../models/http-error");
const getCoordsForAddress = require("../util/location");
const Place = require("../models/place");
const User = require("../models/user");
const exp = require("constants");

const getPlaceById = async (req, res, next) => {
  const placeId = req.params.pid;

  let place;
  try {
    place = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError("Could not find a place.", 500);
    return next(error);
  }

  if (!place) {
    const error = new HttpError("Could not find any place.", 404);
    return next(error);
  }

  res.json({ place: place.toObject({ getters: true }) });
};

const getPlacesByUserId = async (req, res, next) => {
  const userId = req.params.uid;

  let userWithPlaces;
  try {
    userWithPlaces = await User.findById(userId).populate("places");
  } catch (err) {
    const error = new HttpError("Fetching places failed.", 500);
    return next(error);
  }

  if (!userWithPlaces || userWithPlaces.places.length === 0) {
    return next(new HttpError("Could not find places.", 404));
  }

  res.json({
    places: userWithPlaces.places.map((place) =>
      place.toObject({ getters: true })
    ),
  });
};

const createPlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new HttpError("Invalid inputs passed.", 422));
  }

  const { title, description, address } = req.body;
  let coordinates;
  try {
    coordinates = await getCoordsForAddress(address);
  } catch (error) {
    return next(error);
  }

  const createdPlace = new Place({
    title,
    description,
    address,
    location: coordinates,
    image: req.file,
    rating: 0,
    numRating: 0,
    creator: req.userData.userId,
  });

  let user;
  try {
    user = await User.findById(req.userData.userId);
  } catch (err) {
    const error = new HttpError("Creating place failed .", 500);
    return next(error);
  }

  if (!user) {
    const error = new HttpError("Could not find user.", 404);
    return next(error);
  }

  try {
    const sess2 = await mongoose.startSession();
    sess2.startTransaction();
    await createdPlace.save();
    user.places.push(createdPlace);
    await user.save();
    await sess2.commitTransaction();
  } catch (err) {
    const error = new HttpError("Creating place failed.", 500);
    return next(error);
  }

  res.status(201).json({ place: createdPlace });
};

const updatePlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new HttpError("Invalid inputs passed.", 422));
  }

  const { title, description } = req.body;
  const placeId = req.params.pid;

  let place;
  try {
    place = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError("Could not update place.", 500);
    return next(error);
  }

  if (place.creator.toString() !== req.userData.userId) {
    const error = new HttpError("You can only edit your places :).", 401);
    return next(error);
  }

  place.title = title;
  place.description = description;

  try {
    await place.save();
  } catch (err) {
    const error = new HttpError("Could not update place.", 500);
    return next(error);
  }

  res.status(200).json({ place: place.toObject({ getters: true }) });
};

const deletePlace = async (req, res, next) => {
  const placeId = req.params.pid;

  let place;
  try {
    place = await Place.findById(placeId).populate("creator");
  } catch (err) {
    const error = new HttpError("Could not delete place.", 500);
    return next(error);
  }

  if (!place) {
    const error = new HttpError("Could not find place.", 404);
    return next(error);
  }
  if (place.creator.id !== req.userData.userId) {
    const error = new HttpError("You can only delete your places :).", 401);
    return next(error);
  }

  const imagePath = place.image.path;

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();

    await Place.findByIdAndDelete(placeId);
    const currentUser = await User.findById(place.creator.id);
    const index = currentUser.places.findIndex((place) => place == placeId);
    currentUser.places.splice(index, 1);
    await currentUser.save();

    await sess.commitTransaction();
  } catch (err) {
    console.log(err);
    const error = new HttpError("Could not delete place.", 500);
    return next(error);
  }

  fs.unlink(imagePath, (err) => {
    console.log(err);
  });

  res.status(200).json({ message: "Place has been Deleted." });
};

const updatePlaceRating = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new HttpError("Invalid inputs passed.", 422));
  }

  const rating = req.body.rating;
  const placeId = req.params.pid;

  let place;
  try {
    place = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError("Could not update place.", 500);
    return next(error);
  }

  if (place.creator.toString() === req.userData.userId) {
    const error = new HttpError("You cant rate your own places.", 401);
    return next(error);
  }

  const oldRating = place.rating;
  const oldNumRating = place.numRating;
  const newNumRating = oldNumRating + 1;

  const newRating = (oldRating * oldNumRating + rating) / newNumRating;

  place.rating = newRating;
  place.numRating = newNumRating;

  try {
    await place.save();
  } catch (err) {
    const error = new HttpError("Could not update place.", 500);
    return next(error);
  }

  res.status(200).json({ place: place.toObject({ getters: true }) });
};

exports.getPlaceById = getPlaceById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlace = updatePlace;
exports.deletePlace = deletePlace;
exports.updatePlaceRating = updatePlaceRating;

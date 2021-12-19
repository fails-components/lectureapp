# Fancy automated internet lecture system (**FAILS**) - components

This package is part of FAILS.
A web based system developed out of university lectures.
Bascially it is a continous pen based notepad editor  delivering **electronic chalk**  to several beamers in the lecture hall.

The students can follow the lecture also on their tablets and notebooks and can scroll independently and ask questions to the lecturer using a chat function.
Furthermore polls can be conducted.

After the lecture is completed a pdf can be downloaded at anytime.

FAILS components is completely integrated using LTI into LMS such as Moodle.

It is the reincarnation of a system, we are using at our theoretical physics institute for several years. Now *initial development* is almost complete, and the software is tested in current winter term by few docents.

The system is written with containerization and scalability in mind.

Currently it is advised to **not use** FAILS in a large productive environment.
However, you can **use** it for small groups of lectures for **initial tests**.
Feedback on error/issues is appreciated via githubs functions.

FAILS is licensed via GNU Affero GPL version 3.0 

## Package lectureapp
This package contains the web code for the main notepad app, which runs during the lecture.

## Installation
For installation instructions for a containerized envoironment, please see the [fails-components/compositions](https://github.com/fails-components/compositions "fails-components/compositions") repository.
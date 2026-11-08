// Moteur du jeu : logique pure, sans React ni textes. Chaque module couvre un sujet.
export { companyById, currentSalary, gigById, gigPay, gigUnlocked, jobById, jobCommute, jobDrawback, salaryAt, trainingPrice } from './lookup';
export { createGame, migrateGame } from './setup';
export { experienceMonths, hireBreakdown, hireChance, isApplied, jobEligibility, recentFiring, reviewMonths, toggleApplication } from './career';
export type { Eligibility, HireBonus, HireBreakdown } from './career';
export { jobBlameChance, probationLeft, probationMonths, quitJob, resolveJobDecision, setGig, workedHours } from './job';
export { drawCatalog } from './catalog';
export { blameChance, dropTraining, enrollTraining, trainingTuition } from './training';
export { careerPath, promotionAvailable, promotionRequestChance, promotionRequestWait, requestPromotion, resolvePromotion } from './promotion';
export { comfortOf, parkingOf, housingCommute, housingEffects, housingTypeById, marketRent, moveCredit, rentBreakdown, rentChance, rentQuote, saleNet, saleProceeds, setHousingTarget } from './housing';
export type { RentBonus, RentBreakdown, RentQuote } from './housing';
export { buyHome, buyQuote, letProperty, lettingChance, lettingIncome, moveToProperty, propertyProceeds, sellingChance, sellProperty, withdrawProperty } from './property';
export type { BuyQuote } from './property';
export { isOverbooked, setSchedule, weekBreakdown } from './schedule';
export type { WeekBreakdown } from './schedule';
export { experienceGoal, monthlyDrawbacks, monthlyExpenseLines, monthlyExpenses, monthlyIncome, monthlyIncomeLines, projectNextStats, scheduleEffects, skillGains, skillGainSources, statEffectLines } from './effects';
export type { MoneyLine, SkillGainSource, StatLine } from './effects';
export { ageYears, canOpen, checkDeposit, checkWithdraw, closePel, depositSavings, emptySavings, isOpen, livretJeuneEligible, migrateSavings, openSavings, pelClosePreview, SAVINGS_PRODUCTS, savingsBalance, savingsRoom, totalSavings, withdrawSavings } from './savings';
export type { PelClosePreview, TransferCheck } from './savings';
export { availableRepairs, banMonthsLeft, baseCommute, buyVehicle, canDrive, commuteAt, commuteHours, driveBlock, estimatedKm, fuelCost, fuelSpec, hasLicense, inspectionPrice, inspectionStatus, insuranceCost, insuranceFor, insuranceOf, drivingVehicle, isImmobilised, isScrap, malusCo2, malusWeight, marketValue, monthlyKm, parkingOverflow, parkingSpots, registrationFee, repairHours, repairQuote, saleReady, salePrice, sellVehicle, setDrivingStyle, setDrivingVehicle, startRepair, takeInspection, vehicleAgeMonths, vehicleAgeYears, vehicleById, vehicleModel, vehicleQuote, vehicleValue } from './vehicle';
export type { DriveBlock, InspectionStatus, RepairQuote, VehicleQuote, VehicleSource } from './vehicle';
export { endTurn, resolveChoice } from './turn';
export { calendarOf, dismissReport, seasonOf, smicFloor } from './economy';
export type { Season } from './economy';
export { efficiencyDelta, efficiencyLines, isStrained, setWorkStyle, workActive } from './work';
export type { EfficiencyLine } from './work';
export { announceRaise, answerRaiseOffer, raiseStatus, requestRaise } from './raise';
export { addReputation, recordReference, referenceHireBonus, reputationHireBonus, reputationLevel } from './reputation';
export { dismissTeamReport } from './management';
export { bonusApproval, bonusCheck, canFire, canRecruit, eventChoiceOk, fireMember, giveTeamBonus, progressTeam, recruitMember, resolveTeamEvent, setTeamPace, teamOuting } from './management';
export {
  approvalChance, bonusCost, bonusGainFor, bonusMoodGain, bonusStale, bossTypeOf, effectivePace, maxMembers, memberPerf, memberQuarterPerf, memberWeight, traitKnown, moodFactor, moodLevel, newTeam, outingCost, outingWait, teamHappiness, teamHeadcount, teamMood, teamOutput,
  teamProgress, teamPromotionBonus, teamRaiseMerit, teamWage,
} from './team';
export type { MoodLevel, TeamProgress } from './team';

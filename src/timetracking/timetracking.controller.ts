import { Controller, Post, Get, Body, Req } from '@nestjs/common';
import * as rawbody from 'raw-body';
import { returnGetConfig, returnPostConfig } from 'src/functions/returnConfig';
import {
  returnGetBoardsQuery,
  returnColumnsInBoard,
  returnChangeSimpleValueQuery,
  returnGetItemQuery,
  returnGetItemFromBoard,
  returnAddSubitem,
} from 'src/functions/returnQuery';
import {
  parseValueofColumnFromColumnID,
  parseColumnsForIDS,
  parseBoardIDFromSlug,
  parseColumnValuesForString,
} from 'src/functions/parseData';

// import * as process from 'process';
import axios from 'axios';

import { users, variables } from 'src/variables';

let hoursFromForm = '0';
let personId = '';
let personData;
let rate = 0;
let cost;
let label = ' ';
let boardId = 0;
let itemIDinBoard;
let costColumnId = '';
let hoursColumnId = '';
let currentCostValue = '';
let currentHoursValue = '';
let newCostValue = '';
let newHoursValue = '';
let boardSlug;
let timelineColId;
let dateRangeData;
let itemDescription;

@Controller('timetracking')
export class TimetrackingController {
  // POST validate
  @Get()
  getTimetracking() {
    return {};
  }

  @Post()
  async index(@Body() data, @Req() req) {
    // we have to check req.readable because of raw-body issue #57
    // https://github.com/stream-utils/raw-body/issues/57
    if (req.readable) {
      // body is ignored by NestJS -> get raw body from request
      const raw = await rawbody(req);
      const text = raw.toString().trim();
      console.log('body:', text);
    } else {
      //if there is an event field on the body
      if (!!data.event) {
        if (
          data.event.type === 'create_pulse' &&
          data.event.columnValues !== undefined &&
          data.event.groupName !== 'Active Projects' &&
          data.event.columnValues.dropdown !== undefined
        ) {
          console.log(
            'event is create pulse ****************************************************',
          );
          console.log(' data.event', data.event);
          itemDescription = data.event.pulseName;
          console.log('itemDescription', itemDescription);
          //parse time tracking data
          const formData = data.event.columnValues;
          console.log('data.event.columnValues', data.event.columnValues);
          console.log(
            'data.event.columnValues.dropdown',
            data.event.columnValues.dropdown,
          );

          label = formData.dropdown.chosenValues[0].name;
          dateRangeData = formData.date_range;
          boardSlug = label.substring(0, 4);
          personId = String(formData.person.personsAndTeams[0].id);
          console.log('personId', personId);
          personData = users.filter(
            (person) => person.id === String(personId),
          )[0];
          console.log('personData', personData);
          hoursFromForm = formData.numbers.value;
          console.log('personId', personId);
          console.log('label', formData.dropdown.chosenValues[0].name);
          console.log('hoursFromForm', hoursFromForm);
          //parse users data
          // rate = parseRatefromUserID(users, personId);
          rate = personData.rate;
          console.log('rate', rate);

          cost = `${Number(hoursFromForm) * Number(rate) * -1}`;
          console.log('cost', cost);
          //get: boards query
          const graphqlGetBoards = returnGetBoardsQuery(
            variables.PROD_WORKSPACE,
          );
          const getBoardsQuery = returnGetConfig(graphqlGetBoards);
          axios
            .request(getBoardsQuery)
            .then((resGetBoards) => {
              console.log(
                'resGetBoardsQuery *****************************************************************',
              );
              //parse boards data

              boardId = parseBoardIDFromSlug(
                resGetBoards.data.data.boards,
                boardSlug,
              );

              //GET: item in active project board with persons name
              const getBoardItemQuery = returnGetItemFromBoard(
                boardId,
                'name',
                personData.title,
              );
              const getBoardItemCofig = returnGetConfig(getBoardItemQuery);
              return axios.request(getBoardItemCofig);
            })
            .then((getBoardItemRes) => {
              console.log(
                'getBoardItemsRes *****************************************************************',
              );
              // console.log('getBoardItemsRes.data', getBoardItemsRes.data);
              //parse items data
              itemIDinBoard =
                getBoardItemRes.data.data.boards[0].items_page.items[0].id;

              //GET: columns in active project
              const getBoardColumnsQuery = returnColumnsInBoard(boardId);
              const getBoardColumnsConfig =
                returnGetConfig(getBoardColumnsQuery);
              return axios.request(getBoardColumnsConfig);
            })
            .then((getBoardColumnsRes) => {
              console.log(
                'getBoardColumnsRes *****************************************************************',
              );
              //parse columns data
              const columns = getBoardColumnsRes.data.data.boards[0].columns;
              console.log('columns', columns);

              costColumnId = parseColumnValuesForString(columns, 'Cost');
              hoursColumnId = parseColumnValuesForString(columns, 'Hours');
              timelineColId = parseColumnValuesForString(columns, 'Timeline');
              console.log('costColumnId', costColumnId);
              console.log('hoursColumnId', hoursColumnId);
              console.log('timelineColId', timelineColId);

              //TODO: replace getting the item and replacing the entries with create new subitem

              //POST: new subitem
              const postSubitemQuery = returnAddSubitem(
                itemIDinBoard,
                itemDescription,
                hoursColumnId,
                hoursFromForm,
                timelineColId,
                dateRangeData.to,
                dateRangeData.from,
                dateRangeData.changed_at,
                personId,
                costColumnId,
                cost,
              );
              const postSubitemConfig = returnGetConfig(postSubitemQuery);
              return axios.request(postSubitemConfig);
            })
            .then((postSubitemRes) => {
              console.log(
                'postCostToColumnRes**********************************************************************',
                postSubitemRes.data,
              );
            })

            .catch((error) => {
              console.log(
                'error ***************************************************************',
                error,
              );
            });
        } else {
          console.log(
            'ERROR: event type is not create pulse OR data.event.columnValues undefined  ***********************************************',
            'OR group name is not active projects OR data.event.columnValues.dropdown undefined  ***********************************************',
          );
        }
      } else {
        //if there is not an event field on the body
        //it's the verification request
        console.log('no event:', data);
        const requestBody = JSON.stringify({
          challenge: `${data.challenge}`,
        });
        return requestBody;
      }
    }
  }
}
